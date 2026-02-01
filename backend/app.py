import os
import json
import uuid
import random
import time
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, join_room, leave_room, emit
import redis

# 외부 파일에서 단어 리스트 가져오기
from words import WORD_POOL

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
CORS(app)

socketio = SocketIO(app, cors_allowed_origins="*")

# Redis 연결 설정
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'localhost'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    decode_responses=True
)

ROOM_KEY_PREFIX = 'room:'
CARD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'cards')

def get_room_key(room_id):
    return f"{ROOM_KEY_PREFIX}{room_id}"

# --- API ---
@app.route('/api/health')
def health_check():
    return jsonify({'status': 'healthy'})

@app.route('/api/rooms', methods=['POST'])
def create_room():
    try:
        data = request.get_json() or {}
        room_id = str(uuid.uuid4().int)[:4]
        room_key = get_room_key(room_id)
        
        room_data = {
            'id': room_id,
            'name': data.get('name', f'Room {room_id}'),
            'status': 'waiting',
            'host_id': None, # 방장 ID 초기화
            'created_at': datetime.now().isoformat()
        }
        redis_client.set(room_key, json.dumps(room_data))
        redis_client.sadd('rooms:active', room_id)
        return jsonify({'success': True, 'room': room_data}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/rooms/<room_id>/users', methods=['POST'])
def join_room_api(room_id):
    room_key = get_room_key(room_id)
    if not redis_client.exists(room_key):
        return jsonify({'success': False, 'error': 'Room not found'}), 404
    return jsonify({'success': True, 'room_id': room_id})

# --- Helper Functions ---
def update_room_users(room_id):
    users_key = f"room:{room_id}:users"
    users_json_list = redis_client.hvals(users_key)
    users = [json.loads(u) for u in users_json_list]
    socketio.emit('update_user_list', {'users': users}, room=room_id)

def emit_game_state(room_id):
    room_key = get_room_key(room_id)
    raw_data = redis_client.get(room_key)
    if not raw_data: return
    room_data = json.loads(raw_data)
    
    users_key = f"room:{room_id}:users"
    users_list = [json.loads(u) for u in redis_client.hvals(users_key)]
    
    socketio.emit('game_state_update', {
        'room': room_data,
        'users': users_list
    }, room=room_id)

def game_timer_task(room_id):
    count = 60
    while count > 0:
        socketio.sleep(1)
        count -= 1
        socketio.emit('timer_update', {'time': count}, room=room_id)
    socketio.emit('timer_end', {'message': 'Time is up!'}, room=room_id)

# --- AI Logic ---
def trigger_ai_check(room_id):
    socketio.sleep(1.5) 

    room_key = get_room_key(room_id)
    raw_room = redis_client.get(room_key)
    if not raw_room: return
    room_data = json.loads(raw_room)
    
    if room_data['status'] != 'playing': return

    users_key = f"room:{room_id}:users"
    users_map = {uid: json.loads(data) for uid, data in redis_client.hgetall(users_key).items()}
    ai_users = [u for u in users_map.values() if u.get('is_ai')]

    phase = room_data['phase']
    storyteller_id = room_data['storyteller_id']

    if phase == 'storyteller_choosing':
        if users_map.get(storyteller_id, {}).get('is_ai'):
            print(f"🤖 AI Storyteller ({storyteller_id}) is choosing...")
            ai_hand = users_map[storyteller_id]['hand']
            if ai_hand:
                selected_card = random.choice(ai_hand)
                selected_word = random.choice(room_data['word_candidates'])
                
                handle_submit_story({
                    'room_id': room_id,
                    'card_id': selected_card['id'],
                    'word': selected_word,
                    'user_id': storyteller_id 
                }, is_internal=True)

    elif phase == 'audience_submitting':
        for u in ai_users:
            if u['user_id'] == storyteller_id: continue
            if u['submitted']: continue 

            print(f"🤖 AI Audience ({u['username']}) is submitting...")
            available_hand = u['hand']
            
            if available_hand:
                pick = random.choice(available_hand)
                handle_submit_card({
                    'room_id': room_id,
                    'user_id': u['user_id'],
                    'card_id': pick['id'],
                    'card_src': pick['src'],
                    'username': u['username']
                }, is_internal=True)

    elif phase == 'voting':
        voting_candidates = room_data.get('voting_candidates', [])
        
        for u in ai_users:
            if u['user_id'] == storyteller_id: continue
            if u.get('voted'): continue

            print(f"🤖 AI Voter ({u['username']}) is voting...")
            valid_targets = [c for c in voting_candidates if c['user_id'] != u['user_id']]
            
            if valid_targets:
                pick = random.choice(valid_targets)
                handle_submit_vote({
                    'room_id': room_id,
                    'user_id': u['user_id'],
                    'card_id': pick['card_id']
                }, is_internal=True)

# --- Socket Events ---
@socketio.on('connect')
def handle_connect():
    pass

@socketio.on('disconnect')
def handle_disconnect():
    user_map_key = f"socket_map:{request.sid}"
    mapping_data = redis_client.get(user_map_key)
    
    if mapping_data:
        data = json.loads(mapping_data)
        room_id = data.get('room_id')
        user_id = data.get('user_id')
        
        if room_id and user_id:
            users_key = f"room:{room_id}:users"
            user_json = redis_client.hget(users_key, user_id)
            
            # [방장 승계 로직]
            room_key = get_room_key(room_id)
            room_raw = redis_client.get(room_key)
            if room_raw:
                room_data = json.loads(room_raw)
                # 나간 사람이 방장이면
                if room_data.get('host_id') == user_id:
                    remaining_ids = [uid for uid in redis_client.hkeys(users_key) if uid != user_id]
                    if remaining_ids:
                        room_data['host_id'] = remaining_ids[0] # 다음 사람에게 방장 넘김
                        redis_client.set(room_key, json.dumps(room_data))
                        emit('notification', {'message': '👑 방장이 변경되었습니다.'}, room=room_id)

            if user_json:
                user = json.loads(user_json)
                room_key = get_room_key(room_id)
                room_raw = redis_client.get(room_key)
                
                if room_raw and json.loads(room_raw)['status'] == 'playing':
                    user['is_ai'] = True
                    if "(AI)" not in user['username']:
                        user['username'] += " (AI)"
                    redis_client.hset(users_key, user_id, json.dumps(user))
                    
                    emit('notification', {'message': f"⚠️ {user['username']} 연결 끊김 -> AI 전환"}, room=room_id)
                    update_room_users(room_id)
                    trigger_ai_check(room_id)
                else:
                    redis_client.hdel(users_key, user_id)
                    update_room_users(room_id)

            redis_client.delete(user_map_key)
            # 상태 업데이트 (방장 정보 등 갱신)
            emit_game_state(room_id) 

@socketio.on('join_game')
def handle_join_game(data):
    room_id = data.get('room_id')
    user_id = data.get('user_id')
    username = data.get('username')
    
    join_room(room_id)
    
    users_key = f"room:{room_id}:users"
    existing = redis_client.hget(users_key, user_id)
    
    if existing:
        user_info = json.loads(existing)
        user_info['is_ai'] = False
        user_info['username'] = username 
    else:
        user_info = {
            'user_id': user_id,
            'username': username,
            'ready': False,
            'score': 0,
            'hand': [],
            'is_ai': False 
        }
    
    redis_client.hset(users_key, user_id, json.dumps(user_info))
    redis_client.set(f"socket_map:{request.sid}", json.dumps({'room_id': room_id, 'user_id': user_id}))
    
    # [방장 설정] 방장이 없으면 이 사람이 방장
    room_key = get_room_key(room_id)
    room_data = json.loads(redis_client.get(room_key))
    if not room_data.get('host_id'):
        room_data['host_id'] = user_id
        redis_client.set(room_key, json.dumps(room_data))

    update_room_users(room_id)
    emit_game_state(room_id)

@socketio.on('update_profile')
def handle_update_profile(data):
    room_id = data.get('room_id')
    user_id = data.get('user_id')
    new_name = data.get('username')
    
    users_key = f"room:{room_id}:users"
    user_json = redis_client.hget(users_key, user_id)
    if user_json:
        user = json.loads(user_json)
        user['username'] = new_name
        redis_client.hset(users_key, user_id, json.dumps(user))
        update_room_users(room_id)

@socketio.on('refresh_words')
def handle_refresh_words(data):
    room_id = data.get('room_id')
    user_id = data.get('user_id')

    room_key = get_room_key(room_id)
    room_data = json.loads(redis_client.get(room_key))

    if room_data['storyteller_id'] == user_id and room_data.get('reroll_count', 0) > 0:
        room_data['word_candidates'] = random.sample(WORD_POOL, min(10, len(WORD_POOL)))
        room_data['reroll_count'] -= 1
        redis_client.set(room_key, json.dumps(room_data))
        emit_game_state(room_id)

@socketio.on('start_game')
def handle_start_game(data):
    room_id = data.get('room_id')
    # [버그 수정] 확실하게 int로 변환
    try:
        rounds_per_user = int(data.get('rounds_per_user', 2))
    except (ValueError, TypeError):
        rounds_per_user = 2

    try:
        abs_folder = os.path.abspath(CARD_FOLDER)
        all_cards = [f for f in os.listdir(abs_folder) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        
        if not all_cards:
            emit('error', {'message': '서버에 카드 이미지가 없습니다.'}, room=room_id)
            return

        random.shuffle(all_cards)
        deck_key = f"room:{room_id}:deck"
        redis_client.delete(deck_key)
        redis_client.rpush(deck_key, *all_cards)

        users_key = f"room:{room_id}:users"
        user_ids = redis_client.hkeys(users_key)
        
        random.shuffle(user_ids)
        num_users = len(user_ids)
        required_card_count = 2 if num_users == 3 else 1

        for uid in user_ids:
            user = json.loads(redis_client.hget(users_key, uid))
            hand = []
            for _ in range(7):
                f = redis_client.lpop(deck_key)
                if f:
                    # [주의] IP 주소는 환경에 맞게 변경 필요
                    hand.append({'id': f, 'src': f"http://192.168.0.43:5050/static/cards/{f}", 'is_new': False})
            user['hand'] = hand
            user['score'] = 0
            user['submitted_count'] = 0
            user['submitted'] = False
            user['voted'] = False
            user['is_ai'] = False 
            redis_client.hset(users_key, uid, json.dumps(user))

        room_key = get_room_key(room_id)
        room_data = redis_client.get(room_key)
        if room_data:
            rd = json.loads(room_data)
            
            # 전체 라운드 수 계산 (참가자 수 * 인당 턴 수)
            total_rounds = num_users * rounds_per_user

            rd.update({
                'status': 'playing',
                'phase': 'storyteller_choosing',
                'current_round': 1,
                'total_rounds': total_rounds,
                'storyteller_id': user_ids[0],
                'word_candidates': random.sample(WORD_POOL, min(10, len(WORD_POOL))),
                'selected_word': None,
                'audience_card_limit': required_card_count,
                'reroll_count': 10 
            })
            redis_client.set(room_key, json.dumps(rd))
            
            redis_client.delete(f"room:{room_id}:submissions")
            redis_client.delete(f"room:{room_id}:votes")
            
            emit_game_state(room_id)
            trigger_ai_check(room_id)

    except Exception as e:
        print(f"🔥 Error in start_game: {e}")

@socketio.on('submit_story')
def handle_submit_story(data, is_internal=False):
    room_id = data.get('room_id')
    
    room_key = get_room_key(room_id)
    room_data = json.loads(redis_client.get(room_key))
    
    room_data['selected_word'] = data.get('word')
    room_data['storyteller_card_id'] = data.get('card_id')
    room_data['phase'] = 'audience_submitting'
    redis_client.set(room_key, json.dumps(room_data))
    
    submission_key = f"room:{room_id}:submissions"
    uid = data.get('user_id') if is_internal else room_data['storyteller_id']
    
    users_key = f"room:{room_id}:users"
    user_json = redis_client.hget(users_key, uid)
    storyteller_name = "Unknown"
    if user_json:
        storyteller_name = json.loads(user_json).get('username', 'Unknown')

    storyteller_submission = {
        'user_id': uid,
        'card_id': data.get('card_id'),
        'card_src': f"http://192.168.0.43:5050/static/cards/{data.get('card_id')}",
        'is_storyteller': True,
        'username': storyteller_name 
    }
    redis_client.hset(submission_key, data.get('card_id'), json.dumps(storyteller_submission))
    
    emit_game_state(room_id)
    trigger_ai_check(room_id)

@socketio.on('submit_card')
def handle_submit_card(data, is_internal=False):
    room_id = data.get('room_id')
    user_id = data.get('user_id')
    card_id = data.get('card_id')
    
    submission_key = f"room:{room_id}:submissions"
    sub_data = {
        'user_id': user_id,
        'card_id': card_id,
        'card_src': data.get('card_src'),
        'username': data.get('username'),
        'is_storyteller': False
    }
    redis_client.hset(submission_key, card_id, json.dumps(sub_data))
    
    users_key = f"room:{room_id}:users"
    user = json.loads(redis_client.hget(users_key, user_id))
    user['submitted_count'] = user.get('submitted_count', 0) + 1
    
    room_key = get_room_key(room_id)
    room_data = json.loads(redis_client.get(room_key))
    target = int(room_data.get('audience_card_limit', 1))
    
    if user['submitted_count'] >= target:
        user['submitted'] = True
    
    redis_client.hset(users_key, user_id, json.dumps(user))
    
    total_users = redis_client.hlen(users_key)
    total_required = (total_users - 1) * target + 1
    curr_sub = redis_client.hlen(submission_key)
    
    if curr_sub >= total_required:
        room_data['phase'] = 'voting'
        subs = [json.loads(s) for s in redis_client.hvals(submission_key)]
        random.shuffle(subs)
        room_data['voting_candidates'] = subs
        redis_client.set(room_key, json.dumps(room_data))
        redis_client.delete(f"room:{room_id}:votes")
    
    emit_game_state(room_id)
    trigger_ai_check(room_id)

@socketio.on('submit_vote')
def handle_submit_vote(data, is_internal=False):
    room_id = data.get('room_id')
    voter_id = data.get('user_id')
    
    vote_key = f"room:{room_id}:votes"
    redis_client.hset(vote_key, voter_id, data.get('card_id'))
    
    users_key = f"room:{room_id}:users"
    user = json.loads(redis_client.hget(users_key, voter_id))
    user['voted'] = True
    redis_client.hset(users_key, voter_id, json.dumps(user))
    
    total_users = redis_client.hlen(users_key)
    vote_count = redis_client.hlen(vote_key)
    
    if vote_count >= total_users - 1:
        calculate_round_result(room_id)
    
    emit_game_state(room_id)
    trigger_ai_check(room_id)

def calculate_round_result(room_id):
    room_key = get_room_key(room_id)
    room_data = json.loads(redis_client.get(room_key))
    users_key = f"room:{room_id}:users"
    
    storyteller_id = room_data['storyteller_id']
    target_card_id = room_data['storyteller_card_id']
    
    votes = redis_client.hgetall(f"room:{room_id}:votes") 
    submissions = redis_client.hgetall(f"room:{room_id}:submissions")
    
    correct_voters = []
    card_votes_count = {} 
    
    for voter_id, voted_card_id in votes.items():
        if voted_card_id == target_card_id:
            correct_voters.append(voter_id)
        card_votes_count[voted_card_id] = card_votes_count.get(voted_card_id, 0) + 1

    total_voters = len(votes)
    correct_count = len(correct_voters)
    
    scores_to_add = {} 
    score_reasons = {}

    if correct_count == total_voters:
        scores_to_add[storyteller_id] = 0
        score_reasons[storyteller_id] = "모두 정답 😅 (0점)"
        for vid in votes.keys():
            scores_to_add[vid] = 2
            score_reasons[vid] = "정답! (+2)"
    elif correct_count == 0:
        scores_to_add[storyteller_id] = 0
        score_reasons[storyteller_id] = "모두 오답 😢 (0점)"
        for vid in votes.keys():
            scores_to_add[vid] = 2
            score_reasons[vid] = "오답 보너스 (+2)"
    else:
        scores_to_add[storyteller_id] = 3
        score_reasons[storyteller_id] = "성공! (+3)"
        for vid in votes.keys():
            if vid in correct_voters:
                scores_to_add[vid] = 3
                score_reasons[vid] = "정답! (+3)"
            else:
                scores_to_add[vid] = 0
                score_reasons[vid] = "오답"

    for card_id, count in card_votes_count.items():
        if card_id == target_card_id: continue
        
        if card_id in submissions:
            sub_data = json.loads(submissions[card_id])
            owner_id = sub_data['user_id']
            if owner_id != storyteller_id:
                bonus = count
                scores_to_add[owner_id] = scores_to_add.get(owner_id, 0) + bonus
                existing = score_reasons.get(owner_id, "오답")
                score_reasons[owner_id] = f"{existing} / 낚시 {count}명! (+{bonus})"

    user_ids = redis_client.hkeys(users_key)
    for uid in user_ids:
        user = json.loads(redis_client.hget(users_key, uid))
        added = scores_to_add.get(uid, 0)
        user['score'] = user.get('score', 0) + added
        user['last_gained_score'] = added 
        user['last_score_reason'] = score_reasons.get(uid, "-")
        redis_client.hset(users_key, uid, json.dumps(user))
        
    results_for_client = []
    for card_id, sub_json in submissions.items():
        sub_data = json.loads(sub_json)
        sub_data['voters'] = []
        for vid, v_cid in votes.items():
            if v_cid == card_id:
                voter_user = json.loads(redis_client.hget(users_key, vid))
                sub_data['voters'].append(voter_user['username'])
        results_for_client.append(sub_data)
        
    room_data['phase'] = 'result'
    room_data['round_results'] = results_for_client
    redis_client.set(room_key, json.dumps(room_data))
    
    emit_game_state(room_id)

@socketio.on('next_round')
def handle_next_round(data):
    room_id = data.get('room_id')
    room_key = get_room_key(room_id)
    room_data = json.loads(redis_client.get(room_key))
    
    # [수정] 라운드 체크 로직 강화
    current = int(room_data.get('current_round', 1))
    total = int(room_data.get('total_rounds', 10))

    if current >= total:
        room_data['phase'] = 'game_over'
        redis_client.set(room_key, json.dumps(room_data))
        emit_game_state(room_id)
        return

    room_data['current_round'] = current + 1
    users_key = f"room:{room_id}:users"
    user_ids = redis_client.hkeys(users_key)
    user_ids.sort()
    
    try:
        curr_idx = user_ids.index(room_data['storyteller_id'])
        next_idx = (curr_idx + 1) % len(user_ids)
    except ValueError:
        next_idx = 0
    room_data['storyteller_id'] = user_ids[next_idx]
    
    submission_key = f"room:{room_id}:submissions"
    submissions = redis_client.hgetall(submission_key)
    
    user_used_cards = {} 
    for cid, sub_json in submissions.items():
        sub = json.loads(sub_json)
        uid = sub['user_id']
        if uid not in user_used_cards: user_used_cards[uid] = []
        user_used_cards[uid].append(cid)
        
    deck_key = f"room:{room_id}:deck"
    
    for uid in user_ids:
        user = json.loads(redis_client.hget(users_key, uid))
        old_hand = user['hand']
        new_hand = []
        
        used_ids = user_used_cards.get(uid, [])
        for card in old_hand:
            if card['id'] not in used_ids:
                card['is_new'] = False
                new_hand.append(card)
        
        while len(new_hand) < 7: 
            new_card_file = redis_client.lpop(deck_key)
            if new_card_file:
                new_card_url = f"http://192.168.0.43:5050/static/cards/{new_card_file}"
                new_hand.append({'id': new_card_file, 'src': new_card_url, 'is_new': True})
            else:
                break 
        
        user['hand'] = new_hand
        user['submitted'] = False
        user['submitted_count'] = 0
        user['voted'] = False
        redis_client.hset(users_key, uid, json.dumps(user))

    room_data['phase'] = 'storyteller_choosing'
    room_data['selected_word'] = None
    room_data['storyteller_card_id'] = None
    room_data['word_candidates'] = random.sample(WORD_POOL, min(10, len(WORD_POOL)))
    room_data['reroll_count'] = 10 
    
    redis_client.set(room_key, json.dumps(room_data))
    redis_client.delete(submission_key)
    redis_client.delete(f"room:{room_id}:votes")
    
    emit_game_state(room_id)
    trigger_ai_check(room_id)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)
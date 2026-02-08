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

# ==========================================
# [설정] 깃허브 이미지 주소
# ==========================================
EXTERNAL_IMAGE_URL = "https://luke-woojudaddy.github.io/Mind_Sync/decks/deck1"

# ==========================================
# [데이터] 단어 리스트 (imported from words.py)
# ==========================================
from words import WORD_POOL

app = Flask(__name__)
app.config['SECRET_KEY'] = 'mind_sync_secret!'

# 도메인 허용 리스트
allowed_origins = [
    "https://lumiverselab.com",
    "https://mindsync.lumiverselab.com",
    "https://www.lumiverselab.com",
    "http://localhost:3000"
]

CORS(app, resources={r"/api/*": {"origins": allowed_origins}})
# [수정] 모바일 연결 끊김 감지를 위해 ping interval/timeout 설정 추가 (5초 주기)
socketio = SocketIO(app, cors_allowed_origins=allowed_origins, ping_interval=5, ping_timeout=5)

# Redis 연결 설정
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'localhost'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    decode_responses=True
)

ROOM_KEY_PREFIX = 'room:'
CARD_LIST_FILE = os.path.join(os.path.dirname(__file__), 'card_list.json')

def get_room_key(room_id):
    return f"{ROOM_KEY_PREFIX}{room_id}"

# [신규] 이미지 URL 생성 헬퍼 함수
def get_card_url(filename):
    if EXTERNAL_IMAGE_URL:
        # 깃허브 사용 시 주소 반환
        return f"{EXTERNAL_IMAGE_URL}/{filename}"
    else:
        # 로컬 서버 사용 시
        return f"https://api.lumiverselab.com/static/cards/{filename}"

# --- API ---
@app.route('/api/health')
def health_check():
    try:
        redis_client.ping()
        return jsonify({'status': 'healthy', 'redis': 'connected'})
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'redis': str(e)}), 500

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
            'host_id': None,
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
    
    # Get Host ID (Handle potential None/Missing)
    room_key = get_room_key(room_id)
    room_raw = redis_client.get(room_key)
    host_id = "UNKNOWN"
    if room_raw:
        host_id = str(json.loads(room_raw).get('host_id', ''))

    # Sorting Logic (Score-based)
    def get_sort_priority(u):
        uid = str(u.get('user_id', ''))
        # Priority 0: Host
        if uid == host_id:
            return 0
        
        is_ai = str(u.get('is_ai', False)).lower() == 'true'
        # Priority 1: Human
        if not is_ai:
            return 1
        # Priority 2: AI
        return 2

    # Primary sort: Priority, Secondary sort: Join Time (Earlier is better)
    users.sort(key=lambda u: (get_sort_priority(u), u.get('joined_at', 0)))
    
    # [Debug] Print sorted list to verify
    print(f"📋 [Debug] Room {room_id} Sorted Users:", flush=True)
    for i, u in enumerate(users):
        role = "HOST" if str(u['user_id']) == host_id else ("AI" if str(u.get('is_ai', False)).lower()=='true' else "HUMAN")
        print(f"   {i+1}. {u['username']} ({role}) - Joined: {u.get('joined_at')}", flush=True)

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

# --- AI Engine 초기화 ---
from ai_engine import AIEngine

print("⏳ [App] Initializing AI Engine...")
ai_engine = AIEngine(
    card_list_file=CARD_LIST_FILE,
    static_cards_path=os.path.join(os.path.dirname(__file__), 'static', 'cards'),
    word_pool=WORD_POOL,
    external_image_url=EXTERNAL_IMAGE_URL
)

# --- AI Logic ---
def trigger_ai_check(room_id):
    # socketio.sleep(1.5) # 디버깅을 위해 잠시 주석 처리 or 짧게
    socketio.sleep(0.5)

    print(f"🔍 [Debug] Triggering AI Check for Room {room_id}", flush=True)
    room_key = get_room_key(room_id)
    raw_room = redis_client.get(room_key)
    if not raw_room: 
        print(f"   [Debug] Room {room_id} not found in Redis.", flush=True)
        return
    room_data = json.loads(raw_room)
    
    print(f"   [Debug] Status: {room_data.get('status')}, Phase: {room_data.get('phase')}", flush=True)

    # [Zombie Fix] AI 실행 시점의 목표 라운드와 페이즈를 고정 (NameError 방지)
    target_phase = room_data.get('phase')
    target_round = room_data.get('current_round', 1)

    if room_data['status'] != 'playing': 
        print("   [Debug] Game not playing. Skipping AI check.", flush=True)
        return

    users_key = f"room:{room_id}:users"
    users_map = {uid: json.loads(data) for uid, data in redis_client.hgetall(users_key).items()}
    
    # AI 유저 필터링 로직 강화
    ai_users = []
    print(f"   [Debug] Checking {len(users_map)} users...", flush=True)
    for uid, u in users_map.items():
        is_ai_val = u.get('is_ai')
        is_ai_bool = str(is_ai_val).lower() == 'true'
        if is_ai_bool:
            ai_users.append(u)
        print(f"      - User {u.get('username')} ({uid}): is_ai={is_ai_val} (Type: {type(is_ai_val)}) -> Parsed: {is_ai_bool}", flush=True)

    print(f"   [Debug] Found {len(ai_users)} AI users.", flush=True)
    
    phase = room_data['phase']
    storyteller_id = room_data['storyteller_id']

    if phase == 'storyteller_choosing':
        storyteller_user = users_map.get(storyteller_id, {})
        is_storyteller_ai = str(storyteller_user.get('is_ai')).lower() == 'true'
        
        if is_storyteller_ai:
            print(f"   [Debug] Storyteller {storyteller_user.get('username')} is AI. Executing logic...")
            ai_hand = storyteller_user.get('hand', [])
            if ai_hand:
                # 1. 카드는 랜덤 선택 (다양성을 위해)
                selected_card = random.choice(ai_hand)
                
                # 2. 단어 선택 (Smart Reroll Logic)
                final_word = None
                reroll_attempts = 0
                max_rerolls = 3
                
                while reroll_attempts < max_rerolls:
                    word_candidates = room_data['word_candidates']
                    # 분석: (단어, 리롤필요여부)
                    chosen, should_reroll = ai_engine.analyze_storyteller_candidates(selected_card['id'], word_candidates)
                    
                    if not should_reroll and chosen:
                        final_word = chosen
                        break
                    
                    # 리롤 필요한 경우
                    print(f"🎲 [AI Storyteller] Rerolling candidates... (Attempt {reroll_attempts+1}/{max_rerolls})")
                    room_data['word_candidates'] = random.sample(WORD_POOL, min(10, len(WORD_POOL)))
                     # Redis 업데이트 (클라이언트 동기화는 굳이 안 해도 됨, 어차피 AI 내부 결정 과정임)
                    reroll_attempts += 1
                
                # 리롤 다 써도 못 찾으면 -> 현재 후보 중 가장 나은 것(analyze가 None 리턴했을 경우 대비)
                if not final_word:
                    # analyze가 None을 반환했다면 리롤 추천 상황 -> 현재 후보 중 Top 1 강제 선택 로직 필요하지만
                    # 편의상 analyze 함수가 fallback으로 None을 줄 수도 있으므로 다시 호출하거나 랜덤
                    # 여기서는 그냥 현재 후보 중 랜덤 (혹은 가장 높은 점수) 안전장치
                    print("⚠️ [AI Storyteller] Max rerolls reached. Picking random.")
                    final_word = random.choice(room_data['word_candidates'])

                # 최종 결정된 단어 후보군을 Redis 저장 (리롤 했다면 바뀌었으므로)
                redis_client.set(room_key, json.dumps(room_data))

                handle_submit_story({
                    'room_id': room_id,
                    'card_id': selected_card['id'],
                    'word': final_word,
                    'user_id': storyteller_id 
                }, is_internal=True)

    elif phase == 'audience_submitting':
        print("   [Debug] Phase is audience_submitting. Checking AI submissions...")
        selected_word = room_data.get('selected_word')
        target_limit = int(room_data.get('audience_card_limit', 1))

        for u in ai_users:
            if u['user_id'] == storyteller_id: continue
            
            submitted_count = u.get('submitted_count', 0)
            if submitted_count >= target_limit:
                print(f"      - {u['username']} alread submitted {submitted_count}/{target_limit} cards. Skipping.")
                continue 
            
            print(f"      - Processing submission for {u['username']} ({submitted_count}/{target_limit})...")

            # [Feature] 인간적인 딜레이 추가 (너무 빠르면 어색함)
            delay = random.uniform(2.0, 4.0)
            socketio.sleep(delay)

            # [Zombie Fix] 딜레이 후 상태 검증 (라운드/페이즈 변경 시 종료)
            curr_room = json.loads(redis_client.get(room_key))
            if curr_room['phase'] != target_phase or curr_room.get('current_round') != target_round:
                print(f"🛑 [AI Kill Switch] Zombie process detected (Target: {target_phase}/{target_round}, Actual: {curr_room['phase']}/{curr_room.get('current_round')}). Stopping.")
                return

            cards_to_submit = target_limit - submitted_count
            available_hand = u['hand'][:] # 복사본 생성 (원본 보존)
            
            # 이미 제출된 카드가 있다면 hand에서 제외해야 함 (재접속/중간 재실행 시 중복 방지)
            submission_key = f"room:{room_id}:submissions"
            existing_subs = [json.loads(s) for s in redis_client.hvals(submission_key) if json.loads(s)['user_id'] == u['user_id']]
            submitted_card_ids = set(s['card_id'] for s in existing_subs)
            available_hand = [c for c in available_hand if c['id'] not in submitted_card_ids]

            while cards_to_submit > 0 and available_hand:
                try:
                    # AI가 제시어와 가장 비슷한 카드를 선택
                    best_card_id = None
                    if selected_word:
                        # [I18n] Extract Korean word for AI Engine
                        target_word = selected_word['ko'] if isinstance(selected_word, dict) else selected_word
                        best_card_id = ai_engine.get_best_card(target_word, available_hand)
                    
                    pick = None
                    if not best_card_id:
                        print(f"⚠️ [AI Audience] Could not find best card for word '{target_word}'. Picking random.")
                        pick = random.choice(available_hand)
                    else:
                        # src 찾기
                        pick = next((c for c in available_hand if c['id'] == best_card_id), None)
                        if not pick:
                            print(f"⚠️ [AI Audience] Best card ID {best_card_id} not in hand. Picking random.")
                            pick = random.choice(available_hand)

                    handle_submit_card({
                        'room_id': room_id,
                        'user_id': u['user_id'],
                        'card_id': pick['id'],
                        'card_src': pick['src'],
                        'username': u['username']
                    }, is_internal=True)
                    print(f"🤖 [AI Audience] {u['username']} submitted card {pick['id']} for '{selected_word}'")
                    
                    # [Critical Fix] 제출한 카드는 로컬 핸드 목록에서 제거 (중복 제출 방지)
                    available_hand = [c for c in available_hand if c['id'] != pick['id']]
                    cards_to_submit -= 1

                    # [Race Condition Fix] 페이즈가 변경되었는지 즉시 확인
                    # 만약 다른 프로세스/스레드에 의해 이미 투표 단계로 넘어갔다면, 더 이상 제출하지 말고 종료
                    updated_room = json.loads(redis_client.get(room_key))
                    if updated_room['phase'] != 'audience_submitting':
                        print(f"🛑 [Debug] Phase changed to {updated_room['phase']} during AI submission. Stopping AI check.", flush=True)
                        return

                except Exception as e:
                    print(f"❌ [AI Error] Audience submission failed for {u['username']}: {e}")
                    # 치명적 오류 시에도 랜덤 제출 시도 (게임 진행 보장)
                    try:
                        pick = random.choice(available_hand)
                        handle_submit_card({
                            'room_id': room_id,
                            'user_id': u['user_id'],
                            'card_id': pick['id'],
                            'card_src': pick['src'],
                            'username': u['username']
                        }, is_internal=True)
                        print(f"⚠️ [AI Audience] Recovered with random submission for {u['username']}")
                        available_hand = [c for c in available_hand if c['id'] != pick['id']]
                        cards_to_submit -= 1
                        
                        # [Race Condition Fix] 오류 복구 후에도 페이즈 체크
                        updated_room = json.loads(redis_client.get(room_key))
                        if updated_room['phase'] != 'audience_submitting':
                            print(f"🛑 [Debug] Phase changed during AI fallback. Stopping.", flush=True)
                            return

                    except:
                        pass

    elif phase == 'voting':
        selected_word = room_data.get('selected_word')
        voting_candidates = room_data.get('voting_candidates', [])
        
        for u in ai_users:
            if u['user_id'] == storyteller_id: continue
            if u.get('voted'): continue

            # 내 카드는 제외하고 투표해야 함 (voting_candidates에는 내 카드가 포함되어 있을 수 있음)
            # 서버 로직상 본인 카드 투표 방지는 handle_submit_vote 내부에는 없으므로(클라이언트가 막음), AI도 걸러줘야 함
            # 하지만 voting_candidates는 익명화된 상태라 user_id가 있음.
            
            # [Feature] 투표 고민하는 척 딜레이
            delay = random.uniform(3.0, 6.0)
            socketio.sleep(delay)

            # [Zombie Fix] 딜레이 후 상태 검증
            curr_room = json.loads(redis_client.get(room_key))
            if curr_room['phase'] != target_phase or curr_room.get('current_round') != target_round:
                 print(f"🛑 [AI Kill Switch] Zombie process detected during voting. Stopping.")
                 return

            # 본인이 낸 카드 ID 찾기
            my_submission_key = f"room:{room_id}:submissions"
            submissions_map = redis_client.hgetall(my_submission_key)
            my_card_id = None
            for cid, sub_json in submissions_map.items():
                sub = json.loads(sub_json)
                if sub['user_id'] == u['user_id']:
                    my_card_id = cid
                    break
            
            # [Fix] 본인 카드는 투표 후보에서 제외
            valid_candidates = [c for c in voting_candidates if c['user_id'] != u['user_id']]

            # AI가 정답(혹은 가장 유사한 카드)을 추론
            # [I18n] Extract Korean word for AI Engine
            target_word = selected_word['ko'] if isinstance(selected_word, dict) else selected_word
            target_card_id = ai_engine.get_voted_card(target_word, valid_candidates, my_card_id=my_card_id)
            
            if target_card_id:
                handle_submit_vote({
                    'room_id': room_id,
                    'user_id': u['user_id'],
                    'card_id': target_card_id
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
            
            room_key = get_room_key(room_id)
            room_raw = redis_client.get(room_key)
            if room_raw:
                room_data = json.loads(room_raw)
                # 방장이 나갔을 경우 방장 승계 로직 (여기서는 즉시 처리하지 않고 아래 sleep 후 처리로 위임)
                # if room_data.get('host_id') == user_id:
                #     remaining_ids = [uid for uid in redis_client.hkeys(users_key) if uid != user_id]
                #     if remaining_ids:
                #         room_data['host_id'] = remaining_ids[0]
                #         redis_client.set(room_key, json.dumps(room_data))
                #         emit('notification', {'message': '👑 방장이 변경되었습니다.'}, room=room_id)

            if user_json:
                user = json.loads(user_json)
                room_key = get_room_key(room_id)
                room_raw = redis_client.get(room_key)
                
                # 게임 중이면 AI로 전환
                if room_raw and json.loads(room_raw)['status'] == 'playing':
                    user['is_ai'] = True
                    if "(AI)" not in user['username']:
                        user['username'] += " (AI)"
                    redis_client.hset(users_key, user_id, json.dumps(user))
                    emit('notification', {'type': 'warning', 'key': 'notification_disconnect_ai', 'params': {'name': user['username']}}, room=room_id)
                    update_room_users(room_id)
                    trigger_ai_check(room_id)
                else:
                    # [Lobby] 대기실에서는 즉시 삭제하지 않고 잠시 대기 (새로고침 지원)
                    # 1. 연결 끊김 표시
                    user['connected'] = False
                    redis_client.hset(users_key, user_id, json.dumps(user))
                    
                    # 2. 3초 대기 (새로고침 시 재접속 시간 허용)
                    socketio.sleep(3)
                    
                    # 3. 상태 다시 확인
                    current_user_json = redis_client.hget(users_key, user_id)
                    if current_user_json:
                        current_user = json.loads(current_user_json)
                        # 만약 재접속했으면(connected=True) 삭제하지 않음
                        if current_user.get('connected', False):
                            print(f"♻️ [Lobby] User {user['username']} reconnected via refresh. Skipping cleanup.")
                            return

                        # 여전히 끊겨있으면 삭제 진행
                        redis_client.hdel(users_key, user_id)
                        update_room_users(room_id)

                        # 만약 방장이었다면 방장 승계 (삭제 후 남아있는 사람 중)
                        room_data = json.loads(redis_client.get(room_key)) # 최신 데이터 조회
                        if room_data.get('host_id') == user_id:
                            remaining_ids = [uid for uid in redis_client.hkeys(users_key) if uid != user_id]
                            if remaining_ids:
                                room_data['host_id'] = remaining_ids[0]
                                redis_client.set(room_key, json.dumps(room_data))
                                emit('notification', {'type': 'info', 'key': 'notification_host_changed'}, room=room_id)
                            else:
                                # 방에 아무도 없으면 방 삭제 고려 (여기선 단순 유지)
                                pass

            redis_client.delete(user_map_key)
            if room_raw and json.loads(room_raw)['status'] == 'playing':
                 emit_game_state(room_id) 

@socketio.on('join_game')
def handle_join_game(data):
    room_id = data.get('room_id')
    user_id = data.get('user_id')
    username = data.get('username')
    
    join_room(room_id)
    users_key = f"room:{room_id}:users"
    existing = redis_client.hget(users_key, user_id)
    
    # [수정됨] 재접속 처리 로직 강화
    if existing:
        user_info = json.loads(existing)
        # 이미 존재한다면 AI 상태 해제 및 제어권 회복
        user_info['is_ai'] = False
        user_info['username'] = username.replace(" (AI)", "") # AI 태그 제거한 원래 이름 복구
        
        # 만약 연결이 끊겨서 AI로 이름이 바뀌어 있었다면 알림
        if "(AI)" in json.loads(existing).get('username', ''):
             emit('notification', {'type': 'success', 'key': 'notification_user_reconnected', 'params': {'name': user_info['username']}}, room=room_id)
        
        # [Refresh Fix] 재접속 시 status 업데이트
        user_info['connected'] = True
    else:
        # 신규 입장
        user_info = {
            'user_id': user_id,
            'username': username,
            'ready': False,
            'score': 0,
            'hand': [],
            'is_ai': False,
            'connected': True, # [Refresh Fix] 연결 상태 초기화
            'joined_at': time.time() # [Sort Fix] 입장 시간 기록
        }
    
    redis_client.hset(users_key, user_id, json.dumps(user_info))
    redis_client.set(f"socket_map:{request.sid}", json.dumps({'room_id': room_id, 'user_id': user_id}))
    
    room_key = get_room_key(room_id)
    room_data_raw = redis_client.get(room_key)
    if room_data_raw:
        room_data = json.loads(room_data_raw)
        # 방장이 없으면 현재 접속자를 방장으로 지정 (방장이 나가서 빈 자리가 된 경우 등)
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

@socketio.on('add_ai')
def handle_add_ai(data):
    room_id = data.get('room_id')
    requester_id = data.get('user_id')
    
    room_key = get_room_key(room_id)
    room_data = json.loads(redis_client.get(room_key))
    
    # 권한 체크: 방장만 가능
    if room_data.get('host_id') != requester_id:
        return
        
    users_key = f"room:{room_id}:users"
    if redis_client.hlen(users_key) >= 6: # 최대 인원 제한
        return

    ai_names = ["AlphaGo", "Jarvis", "Hal-9000", "Skynet", "GLaDOS", "T-800", "Wall-E"]
    ai_id = f"ai_{uuid.uuid4().hex[:6]}"
    
    # [Unique Name Logic]
    current_users = [json.loads(u) for u in redis_client.hvals(users_key)]
    existing_names = set(u['username'].replace(" (AI)", "") for u in current_users) # AI 태그 제외하고 비교

    random.shuffle(ai_names)
    selected_name = None
    
    # 1. 기본 이름 중 안 겹치는 것 찾기
    for name in ai_names:
        if name not in existing_names:
            selected_name = name
            break
    
    # 2. 다 겹치면 숫자 붙이기
    if not selected_name:
        base_name = random.choice(ai_names)
        suffix = 2
        while f"{base_name} {suffix}" in existing_names:
            suffix += 1
        selected_name = f"{base_name} {suffix}"
    
    ai_name = selected_name

    ai_user = {
        'user_id': ai_id,
        'username': f"{ai_name} (AI)",
        'ready': True,  # AI는 항상 준비됨
        'score': 0,
        'hand': [],
        'is_ai': True,
        'joined_at': time.time() # [Sort Fix] AI 입장 시간 기록
    }
    
    redis_client.hset(users_key, ai_id, json.dumps(ai_user))
    update_room_users(room_id)
    emit('notification', {'type': 'success', 'key': 'notification_ai_added', 'params': {'name': ai_name}}, room=room_id)

@socketio.on('kick_user')
def handle_kick_user(data):
    room_id = data.get('room_id')
    requester_id = data.get('user_id')
    target_id = data.get('target_user_id')

    room_key = get_room_key(room_id)
    room_data = json.loads(redis_client.get(room_key))

    # 권한 체크: 방장만 가능
    if room_data.get('host_id') != requester_id:
        return

    users_key = f"room:{room_id}:users"
    target_user_json = redis_client.hget(users_key, target_id)
    
    if target_user_json:
        target_user = json.loads(target_user_json)
        username = target_user.get('username')
        
        # Redis에서 삭제
        redis_client.hdel(users_key, target_id)
        
        # 소켓 맵에서도 삭제 (재접속 시 방에 다시 들어오는 것 방지)
        # 단, 실제 소켓 연결은 끊지 않음 (클라이언트가 'kicked' 이벤트 받고 처리)
        # 하지만 target_id를 모르면 socket_map 키를 루프 돌려야 하니 생략하거나, 
        # 클라이언트가 알아서 disconnect 처리하도록 유도.
        
        # 알림 발송
        emit('notification', {'type': 'warning', 'key': 'notification_user_kicked', 'params': {'name': username}}, room=room_id)
        
        # 대상에게 강퇴 이벤트 전송
        # (방 전체에 쏘되, 클라이언트가 자기 ID인지 체크하는 방식이 안전)
        emit('kicked', {'target_id': target_id}, room=room_id)
        
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
    print(f"🎮 [Debug] Received start_game event: {data}", flush=True)
    room_id = data.get('room_id')
    try:
        rounds_per_user = int(data.get('rounds_per_user', 2))
    except (ValueError, TypeError):
        rounds_per_user = 2

    try:
        all_cards = []
        if os.path.exists(CARD_LIST_FILE):
            with open(CARD_LIST_FILE, 'r', encoding='utf-8') as f:
                all_cards = json.load(f)
        else:
            static_cards_path = os.path.join(os.path.dirname(__file__), 'static', 'cards')
            if os.path.exists(static_cards_path):
                all_cards = [f for f in os.listdir(static_cards_path) 
                             if f.lower().endswith(('.png', '.jpg', '.jpeg'))]

        if not all_cards:
            emit('error', {'message': '카드 목록(card_list.json)이 없거나 비어있습니다.'}, room=room_id)
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
                    hand.append({'id': f, 'src': get_card_url(f), 'is_new': False})
            user['hand'] = hand
            user['score'] = 0
            user['submitted_count'] = 0
            user['submitted'] = False
            user['voted'] = False
            # [Fix] AI 상태 보존 (기존에는 False로 초기화해버려서 AI가 일반 유저가 됨)
            # user['is_ai'] = False  <-- This was the bug
            # 만약 is_ai 키가 없다면 False로, 있다면 그대로 유지
            if 'is_ai' not in user:
                user['is_ai'] = False
            
            redis_client.hset(users_key, uid, json.dumps(user))

        room_key = get_room_key(room_id)
        room_data = redis_client.get(room_key)
        if room_data:
            rd = json.loads(room_data)
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
        print(f"🔥 Error in start_game: {e}", flush=True)

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
    storyteller_name = json.loads(user_json).get('username', 'Unknown') if user_json else "Unknown"

    storyteller_submission = {
        'user_id': uid,
        'card_id': data.get('card_id'),
        'card_src': get_card_url(data.get('card_id')),
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
    
    # [Fix] 먼저 유저 상태와 제출 제한을 확인하여 초과 제출 방지
    users_key = f"room:{room_id}:users"
    user_json = redis_client.hget(users_key, user_id)
    if not user_json: return
    user = json.loads(user_json)

    room_key = get_room_key(room_id)
    room_data = json.loads(redis_client.get(room_key))
    target = int(room_data.get('audience_card_limit', 1))

    current_count = user.get('submitted_count', 0)
    if current_count >= target:
        print(f"⚠️ [Debug] User {user['username']} tried to submit extra card ({current_count}/{target}). Ignored.", flush=True)
        return

    # 제출 처리 진행
    submission_key = f"room:{room_id}:submissions"
    sub_data = {
        'user_id': user_id,
        'card_id': card_id,
        'card_src': data.get('card_src'),
        'username': data.get('username'),
        'is_storyteller': False
    }
    redis_client.hset(submission_key, card_id, json.dumps(sub_data))
    
    user['submitted_count'] = current_count + 1
    
    if user['submitted_count'] >= target:
        user['submitted'] = True
    
    redis_client.hset(users_key, user_id, json.dumps(user))
    
    total_users = redis_client.hlen(users_key)
    total_required = (total_users - 1) * target + 1
    curr_sub = redis_client.hlen(submission_key)
    
    print(f"📊 [Debug] Submission Check: Current={curr_sub}, Users={total_users}, TargetPerUser={target}, Required={total_required}", flush=True)

    # [Safety Net] 만약 제출 수가 유저 수보다 크거나 같으면 (최소 1장씩은 냈다는 뜻) 강제 진행
    # (비정상적인 상황 방지)
    force_transition = False
    if curr_sub >= total_required:
        # [Critical Fix] 단순히 총 개수만 확인하는 것이 아니라, 모든 유저가 실제로 제출했는지 검증
        # (AI가 중복 제출하거나 카운트 오류가 있어도, 사람이 안 냈으면 넘어가지 않도록 방지)
        all_users_submitted = True
        users_data = redis_client.hgetall(users_key)
        
        storyteller_id = room_data.get('storyteller_id')
        
        for uid, u_json in users_data.items():
            if uid == storyteller_id: continue # 이야기꾼은 audience 카드를 내지 않으므로 제외
            
            u = json.loads(u_json)
            if u.get('submitted_count', 0) < target:
                print(f"🛑 [Debug] Hold transition: User {u['username']} has not submitted enough cards ({u.get('submitted_count', 0)}/{target})", flush=True)
                all_users_submitted = False
                break
        
        if all_users_submitted:
            force_transition = True
        else:
            print("⚠️ [Debug] Total count met but not all users submitted. Waiting...", flush=True)

    elif curr_sub >= total_users and target == 1:
        print("⚠️ [Debug] Force transition triggered (Count mismatch safely handled)", flush=True)
        force_transition = True

    if force_transition:
        print("🚀 [Debug] Transitioning to Voting Phase!", flush=True)
        room_data['phase'] = 'voting'
        subs = [json.loads(s) for s in redis_client.hvals(submission_key)]
        random.shuffle(subs)
        room_data['voting_candidates'] = subs
        redis_client.set(room_key, json.dumps(room_data))
        redis_client.delete(f"room:{room_id}:votes")
        
        # [Race Condition Fix] 상태 변경 알리고 즉시 리턴하여 중복 처리 방지
        emit_game_state(room_id)
        trigger_ai_check(room_id)
        return
    
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
        # [Fix] 중복 계산 방지: 이미 결과 페이즈라면 계산 스킵
        latest_room = json.loads(redis_client.get(get_room_key(room_id)))
        if latest_room['phase'] == 'result':
            print("⚠️ [Debug] Round result already calculated. Skipping.", flush=True)
        else:
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

    if (correct_count == total_voters):
        scores_to_add[storyteller_id] = 0
        score_reasons[storyteller_id] = "score_all_correct"
        for vid in votes.keys():
            scores_to_add[vid] = 2
            score_reasons[vid] = "score_correct_bonus" # Changed from "정답! (+2)" to distinct key if needed, or reuse generic
    elif correct_count == 0:
        scores_to_add[storyteller_id] = 0
        score_reasons[storyteller_id] = "score_all_fail"
        for vid in votes.keys():
            scores_to_add[vid] = 2
            score_reasons[vid] = "score_fail_bonus"
    else:
        scores_to_add[storyteller_id] = 3
        score_reasons[storyteller_id] = "score_success"
        for vid in votes.keys():
            if vid in correct_voters:
                scores_to_add[vid] = 3
                score_reasons[vid] = "score_correct"
            else:
                scores_to_add[vid] = 0
                score_reasons[vid] = "score_fail"

    for card_id, count in card_votes_count.items():
        if card_id == target_card_id: continue
        if card_id in submissions:
            sub_data = json.loads(submissions[card_id])
            owner_id = sub_data['user_id']
            if owner_id != storyteller_id:
                bonus = count
                scores_to_add[owner_id] = scores_to_add.get(owner_id, 0) + bonus
                existing = score_reasons.get(owner_id, "score_fail")
                # Append trick bonus info. Format: "EXISTING_KEY|score_trick:N:S"
                # But simple concatenation might be hard to parse if existing is complex.
                # Let's use a simpler approach: Since trick is usually add-on to 'score_fail' (mostly),
                # or maybe they got it right AND tricked someone? (Can't happen, you vote for storyteller)
                # Wait, generic players submit cards. They vote for storyteller.
                # If they trick someone, it means someone voted for THEIR card.
                # So they can have 'score_correct' AND 'score_trick'.
                
                # Let's use a list or delimited string. 
                # frontend expectation: "KEY" or "KEY1,KEY2:args"
                
                # formatted string: "score_trick:{count}:{bonus}"
                trick_str = f"score_trick:{count}:{bonus}"
                
                if existing == "score_fail":
                     # If they failed to guess storyteller but tricked someone
                    score_reasons[owner_id] = trick_str
                else:
                    # If they guessed right AND tricked someone (Rare? No, possible)
                    score_reasons[owner_id] = f"{existing}|{trick_str}"

    for uid in redis_client.hkeys(users_key):
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
                # [수정] get_card_url 함수 사용
                new_card_url = get_card_url(new_card_file)
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
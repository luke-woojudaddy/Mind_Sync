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
# [데이터] 단어 리스트 (생략 없이 전체 포함)
# ==========================================
WORD_POOL = [
    "그리움", "설렘", "공포", "환희", "우울", "갈망", "평온", "분노", "질투", "동경",
    "고독", "허무", "안도", "연민", "경외", "후회", "희망", "절망", "혼란", "확신",
    "자괴감", "자부심", "시기", "용기", "비겁", "냉소", "열정", "권태", "호기심", "의심",
    "신뢰", "배신감", "서운함", "벅참", "애틋함", "담담함", "조급함", "여유", "긴장", "공허",
    "충만", "수줍음", "대담함", "증오", "사랑", "미련", "상실", "집착", "해방감", "압박감",
    "무기력", "활력", "슬픔", "기쁨", "노여움", "즐거움", "괴로움", "외로움", "괴리감", "소속감",
    "유대감", "단절", "소외", "갈등", "화해", "용서", "원망", "기다림", "망설임", "결단",
    "인내", "체념", "낙심", "환멸", "매혹", "혐오", "불만", "만족", "평화", "혼돈",
    "고요", "소란", "불안", "안정", "신비", "경계", "개방", "폐쇄", "억압", "자유",
    "구속", "갈증", "포만", "결핍", "과잉", "고통", "쾌락", "숭고", "비참", "초조",
    "느긋함", "아쉬움", "뿌듯함", "허탈", "황홀", "무심", "섬세", "예민", "둔감", "집요",
    "방황", "안착", "방관", "참여", "소망", "야망", "탐욕", "절제", "친밀", "소원",
    "어색", "익숙", "생경", "향수", "동심", "성숙", "미성숙", "순수", "타락", "공감",
    "반감", "편견", "이해", "애증", "자애", "비애", "고뇌", "번민", "집념", "염원",
    "비장함", "비굴함", "오만", "겸손", "냉정", "열띤", "들뜬", "가라앉은", "먹먹함", "후련함",
    "찝찝함", "무안함", "황당함", "경멸", "숭배", "갈채", "야유", "환대", "박대", "동질감",
    "이질감", "열등감", "우월감", "회의감", "성취감", "압도됨", "홀가분함", "비통함", "달콤함", "쓰라림",
    "씁쓸함", "설움", "울화", "평정심", "광기", "도취", "황홀경", "무아지경", "염세적", "낙천적",
    "냉혈", "다정함", "냉담함", "무뚝뚝함", "상냥함", "뻔뻔함", "겸허함", "당당함", "위축됨", "처량함",
    "죄책감", "소유욕", "적개심", "자기혐오", "도덕심", "연대감", "무력감", "유혹", "인내심", "호전성",
    "방어기제", "피해의식", "정체성", "자존심", "강박", "트라우마", "콤플렉스", "나르시시즘", "우애", "동포애",
    "인류애", "정의감", "사명감", "무심함", "비정함", "정당함", "억울함", "비참함", "황량함", "포근함",
    "상쾌함", "뭉클함", "멍함", "울컥함", "거만함", "담백함", "끈기", "변덕", "조울", "차분함",
    "막막함", "미안함", "고마움", "쑥스러움", "민망함", "당황스러움", "전율", "다정다감",
    "찰나", "영원", "과거", "미래", "현재", "새벽", "황혼", "정오", "자정", "심연",
    "우주", "미로", "경계", "틈새", "통로", "막다른 길", "시작", "끝", "회귀", "단절",
    "연결", "고립", "광장", "골목", "지평선", "수평선", "궤도", "차원", "평행", "교차",
    "정지", "가속", "감속", "시대", "역사", "전설", "신화", "기억", "망각", "유적",
    "폐허", "낙원", "지옥", "안식처", "은신처", "요새", "감옥", "창문", "거울", "문턱",
    "계단", "다리", "섬", "사막", "오아시스", "빙하", "화산", "늪", "숲", "정원",
    "광야", "심해", "구름 위", "별자리", "은하", "블랙홀", "그림자", "빛", "반사", "굴절",
    "투영", "허상", "실체", "신기루", "환상", "현실", "꿈속", "무의식", "의식", "찰나의 순간",
    "억겁", "계절", "봄날", "한여름", "늦가을", "엄동설한", "세월", "흐름", "고임", "역류",
    "순행", "시계추", "모래시계", "나이테", "흔적", "자국", "잔상", "여운", "궤적", "좌표",
    "방위", "나침반", "지도", "항로", "여정", "목적지", "출발점", "안개 속", "폭풍전야", "만물",
    "무(無)", "진공", "압력", "중력", "무중력", "부양", "추락", "침전", "부유", "파동",
    "진동", "파편", "덩어리", "구체", "평면", "입체", "왜곡", "원형", "본질", "껍데기",
    "심장부", "변두리", "중심", "주변", "너머", "저편", "막간", "시한부", "유통기한", "영겁",
    "태초", "종말", "사후세계", "평행우주", "웜홀", "미답지", "사각지대", "요람", "무덤", "감옥",
    "성역", "금표", "도심", "변두리", "이정표", "갈림길", "막다른 골목", "수직", "수평", "대각선",
    "나선", "소용돌이", "원점", "반환점", "정점", "바닥", "구석", "틈바구니", "허공", "대기실",
    "대합실", "정류장", "항구", "활주로", "궤도 이탈", "무풍지대", "진앙지", "발원지", "거점", "전초기지",
    "안가", "밀실", "광장", "가상세계", "증강현실", "환상향", "무릉도원", "샹그릴라", "아틀란티스", "유토피아",
    "디스토피아", "판도라의 상자", "정적", "소음", "비어있는 방", "붐비는 거리", "지하도", "옥상", "발코니", "간이역",
    "선착장", "비행장", "성지", "폐가", "흉가", "금지구역", "최전방", "휴전선", "국경선", "사선",
    "구름다리", "무지개다리", "징검다리", "외길", "샛길", "지름길", "우회로", "전생", "환생", "다중우주",
    "싱귤래리티", "화이트홀", "구덩이", "구멍", "동굴", "벼랑", "절벽", "비탈길", "터널",
    "가시", "꽃잎", "뿌리", "줄기", "열매", "씨앗", "고목", "넝쿨", "이끼", "돋아남",
    "시듦", "낙엽", "단풍", "파도", "물결", "거품", "소용돌이", "물방울", "이슬", "서리",
    "눈꽃", "우박", "소나기", "가랑비", "무지개", "번개", "천둥", "바람", "돌풍", "미풍",
    "삭풍", "흙", "먼지", "모래", "바위", "보석", "원석", "금속", "녹", "화염",
    "불꽃", "재", "연기", "그을음", "태양", "달", "초승달", "그믐달", "혜성", "유성",
    "성운", "대기", "산소", "향기", "악취", "소리", "소음", "화음", "불협화음", "메아리",
    "울림", "침묵", "깃털", "날개", "부리", "발톱", "비늘", "가죽", "뼈", "껍질",
    "고치", "나비", "벌레", "거미줄", "둥지", "먹이", "포식", "기생", "공생", "야생",
    "가축", "길들임", "숲의 속삭임", "바다의 노래", "땅의 울분", "하늘의 눈물", "구름의 이동", "안개의 장막", "얼음의 침묵", "불의 춤",
    "돌의 인내", "나무의 지혜", "강물의 유랑", "산의 침묵", "들판의 자유", "늪의 유혹", "사막의 고독", "동굴의 비밀", "파도의 포말", "숲의 정적",
    "약속", "유언", "편지", "고백", "비밀", "소문", "거짓말", "진실", "가면", "얼굴",
    "시선", "손길", "발걸음", "포옹", "입맞춤", "작별", "만남", "재회", "동행", "경쟁",
    "협력", "희생", "헌신", "이기심", "배려", "오해", "이해", "관용", "복수", "응징",
    "심판", "구원", "타락", "숭배", "저주", "축복", "기도", "마법", "주문", "계약",
    "속박", "해방", "반역", "혁명", "질서", "혼돈", "법", "규칙", "금기", "전통",
    "혁신", "계승", "단절", "가난", "풍요", "전쟁", "평화", "승리", "패배", "영광",
    "오욕", "왕관", "족쇄", "감시", "보호", "추방", "망명", "귀환", "유랑", "정착",
    "고향", "타향", "우정", "혈연", "연인", "스승", "제자", "원수", "그림자", "분신",
    "역할", "연극", "무대", "관객", "주인공", "조연", "기록", "삭제", "은폐", "노출",
    "감금", "탈출", "미행", "추격", "잠입", "도주", "매복", "습격", "방어", "공격",
    "추상", "구상", "여백", "채움", "비움", "질서", "무질서", "조화", "부조화", "균형",
    "불균형", "대칭", "비대칭", "리듬", "멜로디", "템포", "강약", "고저", "음영", "채도",
    "명도", "농도", "밀도", "강도", "경도", "유연함", "딱딱함", "부드러움", "거침", "매끄러움",
    "날카로운", "뭉툭함", "무거움", "가벼움", "빠름", "느림", "높음", "낮음", "깊음", "얕음",
    "넓음", "좁음", "밝음", "어두움", "선명함", "흐릿함", "왜곡된", "곧은", "굽은", "꼬인",
    "풀린", "얽힌", "흩어진", "모인", "솟은", "꺼진", "팽창", "수축", "폭발", "함몰",
    "연소", "냉각", "응고", "융해", "증발", "승화", "순환", "정체", "진화", "퇴화",
    "변이", "복제", "창조", "파괴", "모방", "독창", "고전", "현대", "아방가르드", "키치",
    "탐미", "숭고미", "추함", "아름다움", "성스러움", "속됨", "아이러니", "패러독스", "은유", "직유",
    "상징", "알레고리", "풍자", "해학", "비극", "희극", "서사", "서정", "낭만", "실존",
    "꿈꾸다", "속이다", "가리다", "드러내다", "훔치다", "나누다", "합치다", "찢다", "붙이다", "태우다",
    "얼리다", "녹이다", "뚫다", "막다", "던지다", "받다", "밀다", "당기다", "오르다", "내리다",
    "뛰다", "걷다", "기어가다", "날다", "헤엄치다", "잠기다", "떠오르다", "가라앉다", "흔들리다", "멈추다",
    "변하다", "유지하다", "깨뜨리다", "고치다", "만들다", "부수다", "찾다", "잃다", "잊다", "기억하다",
    "말하다", "듣다", "보다", "만지다", "느끼다", "생각하다", "믿다", "의심하다", "사랑하다", "미워하다",
    "싸우다", "화해하다", "기다리다", "떠나다", "돌아오다", "숨다", "나타나다", "죽다", "살다", "태어나다",
    "자라다", "늙다", "무너지다", "세우다", "견디다", "포기하다", "시도하다", "실패하다", "성공하다", "배우다",
    "가르치다", "돕다", "방해하다", "빌리다", "갚다", "사다", "팔다", "먹다", "마시다", "자다",
    "깨다", "울다", "웃다", "노래하다", "춤추다", "연주하다", "그리다", "쓰다", "읽다", "걷다",
    "달리다", "서다", "앉다", "눕다", "기대다", "안다", "업다", "잡다", "놓다", "쥐다",
    "알고리즘", "배터리 1%", "로딩 중", "블루스크린", "필터링", "해시태그", "언박싱", "좋아요", "스와이프", "스크롤",
    "하이퍼링크", "팝업창", "다크모드", "와이파이", "핫스팟", "클라우드", "에어드랍", "익명성", "가상화폐", "메타버스",
    "아바타", "증강현실", "인공지능", "챗봇", "갓생", "오운완", "루틴", "번아웃", "퇴사", "취준생",
    "무지출 챌린지", "플렉스", "소확행", "가심비", "가성비", "제로 칼로리", "편의점 도시락", "새벽 배송", "1인 가구", "혼밥",
    "고독사", "욜로", "파이어족", "주식 그래프", "비트코인", "상한가", "하한가", "스마트 도어락", "CCTV", "QR코드",
    "스팸 메일", "실시간 검색어", "브이로그", "입덕", "탈덕", "성덕", "굿즈", "팝업스토어", "오픈런", "품절 대란",
    "리셀", "명품 로고", "어그로", "팩트폭격", "뇌절", "손절", "가스라이팅", "자존감 뿜뿜", "번개 모임", "불금",
    "월요병", "재택근무", "비대면", "랜선 연애", "홈트레이닝", "에코백", "제로 웨이스트", "젠트리피케이션", "공유 경제", "마감 임박",
    "한정판", "블랙 프라이데이", "알림 지옥", "넷플릭스 앤 칠", "스트리밍", "구독 서비스", "타임라인", "스포일러", "쿠키 영상", "멀티 페르소나",
    "프로필 사진", "상태 메시지", "유령 메시지", "읽음 사라짐", "잊혀질 권리", "디지털 포렌식", "딥페이크", "사이버 렉카", "도파민", "블로그",
    "폭신한", "까칠한", "차가운", "뜨거운", "미끈거리는", "끈적이는", "단단한", "무른", "바스라지는", "투명한",
    "탁한", "선명한", "흐릿한", "번지는", "스며드는", "튕겨 나가는", "묵직한", "깃털 같은", "서늘한", "눅눅한",
    "건조한", "매끄러운", "투박한", "날카로운", "뭉툭함", "일렁이는", "고정된", "흔들리는", "아련한", "강렬한",
    "은은한", "몽환적인", "기괴한", "성스러운", "우아한", "촌스러운", "화려한", "소박한", "낡은", "새것의",
    "반짝이는", "녹슨", "축축한", "보송보송한", "아슬아슬한", "견고한", "허술한", "촘촘한", "느슨한", "빽빽한",
    "텅 빈", "가득 찬", "무거운", "가벼운", "빠른", "느림", "깊은", "얕은", "넓은", "좁은",
    "높은", "낮은", "긴", "짧은", "둥근", "각진", "비뚤어진", "곧은", "일그러진", "조화로운",
    "불협화음의", "향기로운", "악취 나는", "달콤한", "쓴", "짠", "신", "매운", "밋밋한", "자극적인",
    "시끄러운", "조용한", "웅장한", "왜소한", "신비로운", "공포스러운", "따스한", "냉혹한", "비정한", "자비로운",
    "거대한", "미세한", "복잡한", "단순한", "원색적인", "무채색의", "따끔한", "가려운", "얼얼한", "아릿한"
]

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
                        best_card_id = ai_engine.get_best_card(selected_word, available_hand)
                    
                    pick = None
                    if not best_card_id:
                        print(f"⚠️ [AI Audience] Could not find best card for word '{selected_word}'. Picking random.")
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
            target_card_id = ai_engine.get_voted_card(selected_word, valid_candidates, my_card_id=my_card_id)
            
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
                # 방장이 나갔을 경우 방장 승계 로직
                if room_data.get('host_id') == user_id:
                    remaining_ids = [uid for uid in redis_client.hkeys(users_key) if uid != user_id]
                    if remaining_ids:
                        room_data['host_id'] = remaining_ids[0]
                        redis_client.set(room_key, json.dumps(room_data))
                        emit('notification', {'message': '👑 방장이 변경되었습니다.'}, room=room_id)

            if user_json:
                user = json.loads(user_json)
                room_key = get_room_key(room_id)
                room_raw = redis_client.get(room_key)
                
                # 게임 중이면 AI로 전환 (새로고침 시 잠시 AI 상태가 되었다가 재접속 시 복구됨)
                if room_raw and json.loads(room_raw)['status'] == 'playing':
                    user['is_ai'] = True
                    if "(AI)" not in user['username']:
                        user['username'] += " (AI)"
                    redis_client.hset(users_key, user_id, json.dumps(user))
                    emit('notification', {'message': f"⚠️ {user['username']} 연결 끊김 -> AI 전환"}, room=room_id)
                    update_room_users(room_id)
                    trigger_ai_check(room_id)
                else:
                    # 대기실에서는 그냥 삭제
                    redis_client.hdel(users_key, user_id)
                    update_room_users(room_id)

            redis_client.delete(user_map_key)
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
             emit('notification', {'message': f"👋 {user_info['username']} 님이 돌아왔습니다!"}, room=room_id)
    else:
        # 신규 입장
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
    ai_name = random.choice(ai_names)
    
    # 중복 이름 방지
    current_users = [json.loads(u) for u in redis_client.hvals(users_key)]
    existing_names = set(u['username'] for u in current_users)
    while ai_name in existing_names:
         ai_name = random.choice(ai_names) + f"_{random.randint(1,9)}"

    ai_user = {
        'user_id': ai_id,
        'username': f"{ai_name} (AI)",
        'ready': True,  # AI는 항상 준비됨
        'score': 0,
        'hand': [],
        'is_ai': True
    }
    
    redis_client.hset(users_key, ai_id, json.dumps(ai_user))
    update_room_users(room_id)
    emit('notification', {'message': f"🤖 AI 플레이어 '{ai_name}'가 추가되었습니다."}, room=room_id)

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
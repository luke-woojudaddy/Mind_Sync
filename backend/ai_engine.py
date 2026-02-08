import os
import json
import random
import numpy as np
import requests
from PIL import Image
from io import BytesIO
import traceback
import torch
from transformers import CLIPProcessor, CLIPModel

# ==========================================
# [설정] AI 엔진 설정
# ==========================================
CACHE_FILE = "ai_cache_v2.npz"
MODEL_NAME = 'clip-ViT-B-32-multilingual-v1'

class AIEngine:
    def __init__(self, card_list_file, static_cards_path, word_pool, external_image_url):
        self.is_ready = False
        self.model = None
        self.word_embeddings = {}
        self.card_embeddings = {}
        self.card_list_file = card_list_file
        self.static_cards_path = static_cards_path
        # [I18n] Extract Korean words for embedding generation if input is list of dicts
        self.word_pool = [w['ko'] if isinstance(w, dict) else w for w in word_pool]
        self.external_image_url = external_image_url
        
        print("🤖 [AI Engine] Initializing...")
        try:
            from sentence_transformers import SentenceTransformer
            from transformers import CLIPProcessor, CLIPModel
            import torch

            print(f"📥 [AI Engine] Loading Text model '{MODEL_NAME}'...")
            self.text_model = SentenceTransformer(MODEL_NAME)
            
            print(f"📥 [AI Engine] Loading Image model 'openai/clip-vit-base-patch32' via Transformers...")
            self.image_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            self.image_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            
            self.is_ready = True
            print("✅ [AI Engine] Models loaded successfully.")
            
            self._load_or_generate_cache()
            
        except Exception as e:
            print(f"⚠️ [AI Engine] Failed to load AI model. Falling back to Random Mode.")
            print(f"   Error: {e}")
            traceback.print_exc()
            self.is_ready = False

    def _load_or_generate_cache(self):
        """캐시를 로드하거나 새로 생성합니다."""
        if not self.is_ready: return

        # 카드 목록 로드
        all_cards = []
        if os.path.exists(self.card_list_file):
            with open(self.card_list_file, 'r', encoding='utf-8') as f:
                all_cards = json.load(f)
        else:
            if os.path.exists(self.static_cards_path):
                all_cards = [f for f in os.listdir(self.static_cards_path) 
                             if f.lower().endswith(('.png', '.jpg', '.jpeg'))]

        # 캐시 확인
        cache_path = os.path.join(os.path.dirname(__file__), CACHE_FILE)
        cache_valid = False
        
        if os.path.exists(cache_path):
            try:
                print(f"📂 [AI Engine] Loading cache from {CACHE_FILE}...")
                data = np.load(cache_path, allow_pickle=True)
                cached_words = data['words']
                cached_cards = data['cards']
                self.word_embeddings = data['word_embeddings'].item()
                self.card_embeddings = data['card_embeddings'].item()
                
                # 데이터 변경 확인 (간단하게 개수와 첫/마지막 아이템으로 비교)
                if (set(cached_words) == set(self.word_pool)) and (set(cached_cards) == set(all_cards)):
                    print("✅ [AI Engine] Cache is up to date.")
                    cache_valid = True
                else:
                    print("🔄 [AI Engine] Data changed. Rebuilding cache...")
            except Exception as e:
                print(f"⚠️ [AI Engine] Cache corrupted. Rebuilding... ({e})")

        if not cache_valid:
            print("⚙️ [AI Engine] Generating embeddings... (This may take a few minutes)")
            self._generate_embeddings(all_cards)
            
            # 캐시 저장
            print(f"💾 [AI Engine] Saving cache to {CACHE_FILE}...")
            np.savez_compressed(
                cache_path, 
                words=self.word_pool, 
                cards=all_cards, 
                word_embeddings=self.word_embeddings, 
                card_embeddings=self.card_embeddings
            )
            print("✅ [AI Engine] Cache saved.")

    def _generate_embeddings(self, all_cards):
        """단어와 이미지의 임베딩을 생성합니다."""
        
        # 1. 단어 임베딩
        print(f"   Running text embeddings for {len(self.word_pool)} words...")
        word_vecs = self.text_model.encode(self.word_pool)
        for i, word in enumerate(self.word_pool):
            self.word_embeddings[word] = word_vecs[i]
            
        # 2. 이미지 임베딩
        print(f"   Running image embeddings for {len(all_cards)} cards...")
        processed_count = 0
        
        # 이미지 로딩 헬퍼
        def load_image(card_id):
            # 1) 로컬 시도
            local_path = os.path.join(self.static_cards_path, card_id)
            if os.path.exists(local_path):
                return Image.open(local_path)
            
            # 2) 외부 URL 시도 (Git Pages 등)
            if self.external_image_url:
                url = f"{self.external_image_url}/{card_id}"
                try:
                    response = requests.get(url, timeout=5)
                    response.raise_for_status()
                    return Image.open(BytesIO(response.content))
                except:
                    pass
            return None

        # 배치 처리 대신 간단히 순차 처리 (오류 발생 시 개별 건너뛰기 위함)
        # 속도를 위해선 배치가 좋지만, 다운로드 실패 가능성 때문에 개별 처리
        for i, card_id in enumerate(all_cards):
            try:
                img = load_image(card_id)
                if img:
                    # [Fix] WebP 호환성 문제 해결: 순수 RGB 이미지로 재생성
                    rgb_img = Image.new("RGB", img.size)
                    rgb_img.paste(img, (0, 0))
                    
                    inputs = self.image_processor(images=rgb_img, return_tensors="pt")
                    with torch.no_grad():
                         vec = self.image_model.get_image_features(**inputs)[0].cpu().numpy().flatten()
                    # [Fix] 확장자 제거하여 키 저장 (.webp vs .png 불일치 해결)
                    key = os.path.splitext(card_id)[0]
                    self.card_embeddings[key] = vec
                    processed_count += 1
                else:
                    print(f"   ⚠️ Image not found: {card_id}")
            except Exception as e:
                print(f"   ⚠️ Error processing {card_id}: {e}")
                traceback.print_exc()
            
            if (i + 1) % 10 == 0:
                print(f"   ... Processed {i + 1}/{len(all_cards)} images")

        print(f"✅ [AI Engine] Embeddings generated. (Words: {len(self.word_embeddings)}, Cards: {processed_count})")

    def _cosine_similarity(self, vec1, vec2):
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        if norm1 == 0 or norm2 == 0: return 0.0
        return np.dot(vec1, vec2) / (norm1 * norm2)

    # --- Public Methods ---

    def analyze_storyteller_candidates(self, card_id, candidates):
        """
        [Smart Reroll Logic]
        단순히 가장 높은 점수의 단어를 뽑는 것이 아니라,
        게임의 재미를 위해 '적당히 모호한(Sweet Spot)' 단어를 찾습니다.
        
        Returns:
            (selected_word, should_reroll)
        """
        # [Fix] 확장자 제거하여 키 조회
        key = os.path.splitext(card_id)[0]
        if not self.is_ready or key not in self.card_embeddings:
            print(f"⚠️ [AI Storyteller] Embedding not found for {card_id} (Key: {key})")
            return random.choice(candidates), False

        try:
            card_vec = self.card_embeddings[key]
            scores = []
            
            for word in candidates:
                # [I18n] word comes as dict {'ko':..., 'en':...} or string
                word_text = word['ko'] if isinstance(word, dict) else word
                
                if word_text in self.word_embeddings:
                    sim = self._cosine_similarity(card_vec, self.word_embeddings[word_text])
                    scores.append((word, sim)) # Return original object
            
            scores.sort(key=lambda x: x[1], reverse=True)
            
            # --- 전략 1: Sweet Spot (0.4 ~ 0.7) 찾기 ---
            # 너무 뻔하지도(>0.8), 너무 뜬금없지도(<0.3) 않은 구간
            sweet_spots = [item for item in scores if 0.4 <= item[1] <= 0.7]
            
            if sweet_spots:
                # 적절한 단어가 있으면 그 중에서 랜덤 선택
                selected = random.choice(sweet_spots)
                # selected[0] is the word object/string
                word_log = selected[0]['ko'] if isinstance(selected[0], dict) else selected[0]
                print(f"🧠 [AI Storyteller] Found Sweet Spot! Card: {card_id} -> {word_log} ({selected[1]:.2f})")
                return selected[0], False
            
            # --- 전략 2: Sweet Spot이 없다면? ---
            # 만약 모든 단어가 너무 뻔하거나(>0.8) 너무 관련없다면(<0.3) -> 리롤 추천
            # 다만, 상위권 점수가 너무 낮으면(<0.3) 무조건 리롤
            top_score = scores[0][1] if scores else 0
            if top_score < 0.35:
                print(f"🧠 [AI Storyteller] Scores too low (Top: {top_score:.2f}). Suggest Reroll.")
                return None, True
            
            if top_score > 0.85:
                 print(f"🧠 [AI Storyteller] Scores too obvious (Top: {top_score:.2f}). Suggest Reroll.")
                 return None, True

            # 리롤 조건에 해당하지 않지만 Sweet Spot도 아닌 애매한 경우 -> 그냥 Top Pick 사용
            # (계속 리롤할 순 없으므로)
            word_log = scores[0][0]['ko'] if isinstance(scores[0][0], dict) else scores[0][0]
            print(f"🧠 [AI Storyteller] No Sweet Spot, but usable. Pick Top 1: {word_log}")
            return scores[0][0], False
            
        except Exception as e:
            print(f"⚠️ [AI Error] analyze_storyteller_candidates: {e}")
            return random.choice(candidates), False

    def get_best_card(self, word, card_hand_list):
        """[제출 단계] 제시어와 가장 비슷한 카드를 내 손에서 선택합니다."""
        if not self.is_ready or word not in self.word_embeddings:
            return random.choice(card_hand_list)['id']

        try:
            word_vec = self.word_embeddings[word]
            scores = []
            
            for card in card_hand_list:
                card_id_orig = card['id']
                # [Fix] 확장자 제거
                key = os.path.splitext(card_id_orig)[0]
                
                if key in self.card_embeddings:
                    sim = self._cosine_similarity(self.card_embeddings[key], word_vec)
                    scores.append((card_id_orig, sim))
                else:
                    scores.append((card_id_orig, -1.0)) # 임베딩 없으면 최하점
            
            scores.sort(key=lambda x: x[1], reverse=True)
            
            # 가장 높은 점수 선택
            best_card = scores[0][0]
            print(f"🧠 [AI Submit] Word: '{word}' -> Hand Scores: {[f'{c[:5]}..({s:.2f})' for c, s in scores[:3]]} -> Picked: {best_card}")
            return best_card

        except Exception as e:
            print(f"⚠️ [AI Error] get_best_card: {e}")
            return random.choice(card_hand_list)['id']

    def get_voted_card(self, word, voting_candidates, my_card_id=None):
        """[투표 단계] 제시어와 가장 비슷한 카드를 찾습니다 (본인 카드 제외)"""
        # voting_candidates: [{'user_id':..., 'card_id':...}, ...]
        if not self.is_ready or word not in self.word_embeddings:
             # 랜덤 선택 (본인 카드 제외)
            valid = [c for c in voting_candidates if c['card_id'] != my_card_id]
            if not valid: return None
            return random.choice(valid)['card_id']

        try:
            word_vec = self.word_embeddings[word]
            scores = []
            
            for candidate in voting_candidates:
                c_id = candidate['card_id']
                if c_id == my_card_id: continue # 내 카드는 투표 불가 (이미 필터링 되어 오겠지만 안전장치)
                
                # [Fix] 확장자 제거
                key = os.path.splitext(c_id)[0]
                if key in self.card_embeddings:
                    sim = self._cosine_similarity(self.card_embeddings[key], word_vec)
                    scores.append((c_id, sim, candidate['user_id']))
                else:
                    scores.append((c_id, -1.0, candidate['user_id']))

            scores.sort(key=lambda x: x[1], reverse=True)
            
            if not scores: return None
            
            # 투표는 정답을 맞춰야 하므로 Top 1 선택
            best_choice = scores[0][0]
            print(f"🧠 [AI Vote] Word: '{word}' -> Vote Scores: {[f'{c[:5]}..({s:.2f})' for c, s, u in scores[:3]]} -> Voted: {best_choice}")
            return best_choice
            
        except Exception as e:
            print(f"⚠️ [AI Error] get_voted_card: {e}")
            valid = [c for c in voting_candidates if c['card_id'] != my_card_id]
            return random.choice(valid)['card_id'] if valid else None

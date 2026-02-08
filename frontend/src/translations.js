export const translations = {
    ko: {
        // Lobby
        title: "Mind Sync",
        subtitle: "서로의 마음을 잇는 공감 추리 게임",
        enter_nickname: "닉네임을 입력하세요",
        create_room: "방 만들기",
        enter_room_code: "방 코드 입력",
        join_room: "참여하기",
        rules_btn: "게임 규칙",
        tutorial_btn: "튜토리얼",

        // Waiting Room
        waiting_room: "대기실",
        room_code: "방 코드",
        copy_invite: "초대 링크 복사",
        copied: "복사됨!",
        start_game: "게임 시작",
        waiting_host: "방장의 시작을 기다리는 중...",
        add_ai: "AI 추가",
        rounds_label: "인당 라운드 수",

        // Game Phases
        phase_storyteller: "이야기꾼의 선택",
        phase_audience: "카드 제출",
        phase_voting: "투표",
        phase_result: "결과 발표",

        // Instructions
        storyteller_instruction: "제시어와 가장 잘 어울리는 카드를 선택하세요!",
        storyteller_word_instruction: "이제 이 카드와 어울리는 단어를 선택하세요.",
        audience_instruction: "이야기꾼의 단어: {word}",
        audience_sub_instruction: "이 단어와 가장 비슷한 느낌의 카드를 내세요.",
        voting_instruction: "이야기꾼이 냈을 것 같은 카드를 찾아 투표하세요!",
        result_instruction: "라운드 결과",

        // UI Elements
        submit: "제출하기",
        vote: "투표하기",
        next_round: "다음 라운드",
        my_card: "내 카드",
        storyteller: "이야기꾼",

        // Rules Modal
        rules_title: "게임 규칙",
        rule_1_title: "1. 이야기꾼의 턴",
        rule_1_desc: "이야기꾼은 자신의 카드 중 하나를 고르고, 그 카드와 어울리는 '단어'를 선택합니다.",
        rule_2_title: "2. 다른 플레이어의 제출",
        rule_2_desc: "나머지 플레이어들은 이야기꾼이 제시한 단어를 보고, 자신의 패에서 가장 비슷하다고 생각되는 카드를 냅니다.",
        rule_3_title: "3. 투표",
        rule_3_desc: "모든 카드가 섞여서 공개됩니다. 플레이어들은 이야기꾼이 냈던 카드를 추측하여 투표합니다. (자기 카드 투표 불가)",
        rule_4_title: "4. 점수 계산",
        rule_4_desc: "모두 정답/오답: 이야기꾼 0점, 나머지 2점. 그 외: 이야기꾼 3점, 정답자 3점. 낚시 보너스: +1점",
        understand: "알겠어요!",

        // Tips
        tip_prefix: "💡 Tip: ",
        // Status Messages
        storyteller_thinking: "이야기꾼이 고민 중입니다...",
        storyteller_thinking_desc: "어떤 기상천외한 단어가 나올까요?",
        submitted: "제출 완료!",
        waiting_others: "다른 플레이어들이 고민 중입니다...",
        game_tip: "Game Tip",

        // Buttons & Labels
        scoreboard: "점수판",
        final_result: "최종 결과 보기",
        close: "닫기",
        confirm_storyteller: "이 카드로 결정! 🎯",
        submit_card: "이 카드로 제출! 🔥",
        vote_confirm: "🗳️ 이게 정답이다!",
        back_to_lobby: "로비로 돌아가기",
        submit_card_count: "제출 ({current}/{total})",

        // Results
        result_storyteller_success: "나이스 스토리텔링! 성공입니다! 🎭",
        result_storyteller_fail: "이런! 모두 맞추거나 모두 틀렸네요... 😅",
        result_audience_correct: "정답입니다! 훌륭한 눈썰미네요! 👁️",
        result_audience_bait: "월척입니다! 낚시 대성공! 🎣",
        result_audience_success_score: "점수 획득 성공! 🎉",
        result_audience_fail: "아쉽네요... 다음엔 맞출 수 있어요! 😢",

        // Game Over
        game_over_win: "🥇 우승을 축하합니다! 당신이 최고의 이야기꾼! 🎉",
        game_over_lose: "꼴찌라니... 아쉽네요 😅 다음엔 더 잘할 수 있어요!",
        game_over_normal: "수고하셨습니다! 즐거운 게임 되셨나요? 😊",

        // Tutorials
        tutorial_step1_title: "1. 이야기꾼의 선택",
        tutorial_step1_desc: "제시된 그림과 가장 잘 어울리는 **키워드**를 하나 선택하세요.\n딱 맞는 단어가 없다면 **변경(🎲)** 버튼을 눌러 새로운 단어를 받을 수 있어요!",
        tutorial_step2_title: "2. 친구들의 낚시",
        tutorial_step2_desc: "주제와 가장 비슷한 느낌의 **내 카드**를 몰래 제출하세요.\n다른 사람들이 내 카드를 정답으로 착각하게 만들어야 점수를 얻습니다!",
        tutorial_step3_title: "3. 정답 맞히기",
        tutorial_step3_desc: "모든 카드가 공개되었습니다!\n이야기꾼이 냈던 **진짜 카드**가 무엇인지 추리해서 투표하세요.",
        start_game_rocket: "게임 시작하기 🚀",
        prev_btn: "◀ 이전",
        next_btn: "다음 ▶",
        tutorial_close: "닫기",

        // Alerts & Status
        alert_room_create_fail: "방 생성 실패",
        alert_room_join_fail: "방 입장 실패: ",
        alert_enter_room_code: "방 번호를 입력해주세요!",
        alert_update_name_success: "이름이 변경되었습니다!",
        alert_kick_confirm: "정말 이 사용자를 강퇴하시겠습니까?",
        alert_kicked: "방장에 의해 강퇴되었습니다.",
        notification_copy_success: "초대 링크가 복사되었습니다! 🔗",
        notification_copy_fail: "초대 링크 복사에 실패했습니다.",
        notification_pick_more: "카드를 한 장 더 선택해주세요!",
        notification_ai_added: "🤖 AI 플레이어 '{name}'가 추가되었습니다.",
        notification_user_kicked: "🚫 '{name}' 님이 강퇴되었습니다.",
        notification_host_changed: "👑 방장이 변경되었습니다.",
        notification_disconnect_ai: "⚠️ '{name}' 연결 끊김 -> AI 전환",
        notification_user_reconnected: "👋 '{name}' 님이 돌아왔습니다!",

        // Tips List
        tips_list: [
            "이야기꾼은 너무 쉽지도, 너무 어렵지도 않게 단어를 선정해야 점수를 얻습니다!",
            "내 카드가 정답으로 오해받으면(낚시) 추가 점수를 얻을 수 있습니다.",
            "다른 사람의 심리를 파악해보세요. 평소 그 사람의 생각 패턴이 힌트가 됩니다.",
            "그림의 전체적인 분위기보다는 작은 디테일 하나가 결정적 힌트일 수 있습니다.",
            "이야기꾼이 되면 과감한 단어 선택보다는 공감할 수 있는 단어가 유리할 때도 있습니다.",
            "너무 뻔한 카드를 내면 낚시에 실패할 확률이 높습니다. 살짝 비틀어보세요!",
            "이야기꾼의 평소 관심사나 취미를 생각하면 정답이 보일지도 모릅니다.",
            "색감이 비슷한 카드는 혼란을 주기 좋습니다. 색깔을 활용해보세요.",
            "추상적인 단어일수록 그림의 느낌(몽환적, 어두움 등)에 집중하는 것이 좋습니다.",
            "속담이나 영화 제목, 노래 가사를 인용하면 더 재밌는 이야기가 됩니다.",
            "카드를 고를 때 너무 오래 고민하면 오히려 남들이 눈치챌 수 있습니다.",
            "내 카드가 정답 같아 보여도, 투표 때는 냉정하게 다른 카드를 살펴봐야 합니다.",
            "이야기꾼이 낸 단어가 '명사'인지 '형용사'인지 잘 생각해보세요.",
            "가끔은 아무런 관련 없어 보이는 카드가 정답일 때도 있습니다. (이야기꾼의 실수일 수도?)",
            "점수가 뒤처지고 있다면 과감한 낚시로 역전을 노려보세요!"
        ],
        // Hero & Landing
        hero_title: "Mind Sync",
        hero_subtitle: "AI 그림을 보고 친구의 속마음을 맞혀보세요.",
        hero_description_1: "설치 없는 웹 보드게임!",
        hero_description_2: "처음이신가요? 30초 만에 게임 배우기",

        // Features
        feature_1_title: "무한한 AI 아트",
        feature_1_desc: "AI가 창조한 몽환적이고 초현실적인 그림들이\n여러분의 상상력을 끊임없이 자극합니다.",
        feature_2_title: "설치 없는 웹 게임",
        feature_2_desc: "PC, 모바일 어디서든 링크만 있으면 접속 완료!\n3초 만에 바로 시작하세요.",
        feature_3_title: "텔레파시 눈치 게임",
        feature_3_desc: "뻔한 정답은 없습니다.\n오직 친구와의 교감만이 승리의 열쇠입니다.",
        feature_main_title: "상상력과 눈치의 심리전",
        feature_main_desc_1: "Mind Sync는 AI가 그려낸 몽환적인 그림을 보고 서로의 생각을 맞히는 웹 보드게임입니다.",
        feature_main_desc_2: "'딕싯(Dixit)'과 같은 스토리텔링 게임을 좋아하시나요? 그렇다면 Mind Sync의 매력에도 푹 빠지실 겁니다.",
        feature_main_desc_3: "설치나 카드 구매 없이, 링크 하나로 친구들과 즉시 심리전을 시작해보세요.",
        footer_copyright: "© 2024 Mind Sync • Powered by Lumiverse Lab",

        // Lobby & Settings
        change_name: "이름 변경",
        total_rounds_info: "총 {n} 라운드가 진행됩니다.",
        waiting_for_players: "WAITING FOR PLAYERS ({current}/{total})",
        host_setting_game: "호스트가 게임을 설정하고 있습니다...",

        // In-Game UI
        submitted_count: "{c} / {t}장 제출됨",
        my_cards: "내 카드",
        reroll_words: "단어 변경 ({n}/10)",
        reroll_limit_reached: "변경 불가",
        reroll_warning: "※ 단어 변경 시 이전 단어들은 다시 선택할 수 없습니다.",
        select_word_prompt: "단어를 선택해주세요",
        confirm_selection: "\"{word}\" (으)로 결정하기",
        choosing_topic: "주제 선정 중...",
        tallying_results: "집계 중...",
        no_votes: "득표 없음",
        label_correct_card: "👑 정답 카드",

        // Results & Toasts
        score_success: "성공! (+3)",
        score_fail: "오답",
        score_fail_bonus: "오답 보너스 (+2)",
        score_correct: "정답! (+3)",
        score_trick: "낚시 {n}명! (+{s})",
        score_all_correct: "모두 정답 😅 (0점)",
        score_all_fail: "모두 오답 😢 (0점)",
        waiting_round: "대기 중",
    },
    en: {
        // Lobby
        title: "Mind Sync",
        subtitle: "Empathy Deduction Game Connecting Minds",
        enter_nickname: "Enter your nickname",
        create_room: "Create Room",
        enter_room_code: "Enter Room Code",
        join_room: "Join",
        rules_btn: "Rules",
        tutorial_btn: "Tutorial",

        // Hero & Landing
        hero_title: "Mind Sync",
        hero_subtitle: "Guess your friends' thoughts through AI art.",
        hero_description_1: "No-install Web Board Game!",
        hero_description_2: "New here? Learn in 30 seconds.",

        // Features
        feature_1_title: "Infinite AI Art",
        feature_1_desc: "Dreamy, surreal AI-generated images stimulate your imagination.",
        feature_2_title: "No-Install Web Game",
        feature_2_desc: "Access from PC or Mobile instantly! Start in 3 seconds.",
        feature_3_title: "Telepathy & Wits",
        feature_3_desc: "There are no obvious answers.\nConnection with friends is the key to victory.",
        feature_main_title: "A psychological game of imagination and wits.",
        feature_main_desc_1: "Mind Sync is a web board game where you connect with friends using dreamy AI art.",
        feature_main_desc_2: "Love storytelling games like 'Dixit'? You will fall in love with Mind Sync.",
        feature_main_desc_3: "Start instantly with just a link. No install, no purchase needed.",
        footer_copyright: "© 2024 Mind Sync • Powered by Lumiverse Lab",

        // Lobby & Settings
        change_name: "Change Name",
        total_rounds_info: "Total {n} rounds will be played.",
        waiting_for_players: "WAITING FOR PLAYERS ({current}/{total})",
        host_setting_game: "The host is setting up the game...",

        // Waiting Room
        waiting_room: "Waiting Room",
        room_code: "Room Code",
        copy_invite: "Copy Invite Link",
        copied: "Copied!",
        start_game: "Start Game",
        waiting_host: "Waiting for host to start...",
        add_ai: "Add AI",
        rounds_label: "Rounds per Person",

        // Game Phases
        phase_storyteller: "Storyteller's Turn",
        phase_audience: "Submit Card",
        phase_voting: "Voting",
        phase_result: "Round Result",

        // Instructions
        storyteller_instruction: "Select a card that matches a word!",
        storyteller_word_instruction: "Now select a word that matches this card.",
        audience_instruction: "Storyteller's Word: {word}",
        audience_sub_instruction: "Submit a card that best matches this word.",
        voting_instruction: "Vote for the card you think the Storyteller submitted!",
        result_instruction: "Round Result",

        // UI Elements
        submit: "Submit",
        vote: "Vote",
        next_round: "Next Round",
        my_card: "My Card",
        storyteller: "Storyteller",

        // In-Game UI
        submitted_count: "{c} / {t} Submitted",
        my_cards: "My Cards",
        reroll_words: "Reroll Words ({n}/10)",
        reroll_limit_reached: "No Rerolls Left",
        reroll_warning: "※ You cannot revert to previous words after rerolling.",
        select_word_prompt: "Please select a word",
        confirm_selection: "Confirm \"{word}\"",
        choosing_topic: "Choosing Topic...",
        tallying_results: "Tallying Results...",
        no_votes: "No Votes",
        label_correct_card: "👑 Correct Card",

        // Rules Modal
        rules_title: "Game Rules",
        rule_1_title: "1. Storyteller's Turn",
        rule_1_desc: "The Storyteller picks one of their cards and selects a 'word' that matches it.",
        rule_2_title: "2. Others Submit",
        rule_2_desc: "Other players submit the card from their hand that best matches the Storyteller's word.",
        rule_3_title: "3. Voting",
        rule_3_desc: "All cards are shuffled and revealed. Players vote for the card they think belongs to the Storyteller. (Cannot vote for own card)",
        rule_4_title: "4. Scoring",
        rule_4_desc: "All Correct/Incorrect: Storyteller 0 pts, Others 2 pts. Otherwise: Storyteller 3 pts, Correct Voters 3 pts. Bait Bonus: +1 pt",
        understand: "Got it!",

        // Tips
        tip_prefix: "💡 Tip: ",
        // Status Messages
        storyteller_thinking: "Storyteller is thinking...",
        storyteller_thinking_desc: "What creative word will they choose?",
        submitted: "Submitted!",
        waiting_others: "Waiting for others...",
        game_tip: "Game Tip",

        // Buttons & Labels
        scoreboard: "Scoreboard",
        final_result: "View Final Results",
        close: "Close",
        confirm_storyteller: "Confirm Selection! 🎯",
        submit_card: "Submit This Card! 🔥",
        vote_confirm: "🗳️ This is it!",
        back_to_lobby: "Back to Lobby",
        submit_card_count: "Submit ({current}/{total})",

        // Results
        result_storyteller_success: "Nice Storytelling! Success! 🎭",
        result_storyteller_fail: "Oops! Everyone guessed it or no one did... 😅",
        result_audience_correct: "Correct! Great eye! 👁️",
        result_audience_bait: "Big Catch! Bait Success! 🎣",
        result_audience_success_score: "Points Gained! 🎉",
        result_audience_fail: "Too bad... You'll get it next time! 😢",

        // Results & Toasts
        score_success: "Success! (+3)",
        score_fail: "Incorrect",
        score_fail_bonus: "Wrong Answer Bonus (+2)",
        score_correct: "Correct! (+3)",
        score_trick: "Tricked {n}! (+{s})",
        score_all_correct: "Everyone Correct 😅 (0 pts)",
        score_all_fail: "Everyone Wrong 😢 (0 pts)",
        waiting_round: "Waiting...",

        // Game Over
        game_over_win: "🥇 Congratulations! You are the Best Storyteller! 🎉",
        game_over_lose: "Last place... Too bad 😅 You can do better next time!",
        game_over_normal: "Great Game! Did you have fun? 😊",

        // Tutorials
        tutorial_step1_title: "1. Storyteller's Choice",
        tutorial_step1_desc: "Select a **keyword** that best matches the picture.\nIf no word fits, use the **Reroll(🎲)** button to get new words!",
        tutorial_step2_title: "2. Baiting Others",
        tutorial_step2_desc: "Submit a **card from your hand** that best matches the theme.\nTrick others into picking your card to gain points!",
        tutorial_step3_title: "3. Find the Answer",
        tutorial_step3_desc: "All cards are revealed!\nGuess and vote for the **Storyteller's real card**.",
        start_game_rocket: "Start Game 🚀",
        prev_btn: "◀ Prev",
        next_btn: "Next ▶",
        tutorial_close: "Close",

        // Alerts & Status
        alert_room_create_fail: "Failed to create room.",
        alert_room_join_fail: "Failed to join room.",
        alert_enter_room_code: "Please enter a room code!",
        alert_update_name_success: "Name updated successfully!",
        alert_kick_confirm: "Are you sure you want to kick this user?",
        alert_kicked: "You have been kicked by the host.",
        notification_copy_success: "Invite link copied! 🔗",
        notification_copy_fail: "Failed to copy invite link.",
        notification_pick_more: "Please select one more card!",
        notification_ai_added: "🤖 AI Player '{name}' added.",
        notification_user_kicked: "🚫 '{name}' was kicked.",
        notification_host_changed: "👑 Host changed.",
        notification_disconnect_ai: "⚠️ '{name}' disconnected -> Switched to AI",
        notification_user_reconnected: "👋 '{name}' is back!",

        // Tips List
        tips_list: [
            "The Storyteller scores by being neither too obvious nor too obscure!",
            "If your card is mistaken for the answer (Fishing), you get bonus points.",
            "Try to read others' minds. Their thinking patterns are hints.",
            "A small detail in the picture can be a decisive hint rather than the overall mood.",
            "As a Storyteller, sometimes a completely relatable word is better than a bold one.",
            "If you submit a too obvious card, it's hard to trick others. Twist it a bit!",
            "Thinking about the Storyteller's interests might reveal the answer.",
            "Cards with similar colors are good for confusing others.",
            "For abstract words, focus on the feeling (dreamy, dark, etc.) of the picture.",
            "Quoting proverbs, movie titles, or lyrics makes for a fun story.",
            "Thinking too long as a Storyteller might give it away.",
            "Even if your card looks like the answer, review others objectively during voting.",
            "Consider if the Storyteller's word is a 'Noun' or an 'Adjective'.",
            "Sometimes a completely unrelated card is the answer. (Storyteller's mistake?)",
            "If you are behind, try a bold fishing attempt to turn the tables!"
        ]
    }
};

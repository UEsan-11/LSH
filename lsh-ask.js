/* ═══════════════════════════════════════
   小赫米 AI 問答氣泡
   Claude API + LSH 資料庫
   ═══════════════════════════════════════ */

(function () {

  /* ── 設定 ── */
  const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
  /* 注意：API Key 不可放前端公開頁面
     建議：用 Cloudflare Worker / Supabase Edge Function 代理
     暫時測試可直接填，上線前務必換成代理 */
  const API_KEY = 'YOUR_CLAUDE_API_KEY'; // ← 換成你的 key 或代理網址

  /* ── LSH 知識庫（從 works 資料濃縮） ── */
  const LSH_CONTEXT = `
你是「小赫迷 AI」，이수혁（李洙赫）的專屬知識助手。
你非常了解이수혁，回答時親切自然，像粉絲聊天一樣，繁體中文回答。
如果問題超出資料範圍就說「這個我還不確定，可以去查查看！」
不要回答跟이수혁無關的問題，請說「我只懂이수혁的事情喔！」

【基本資料】
- 本名：이수혁（李洙赫）
- 生日：1988年5月31日，雙子座
- 身高：184cm，血型：AB型
- 出身：韓國京畿道果川市
- 公司：Saram Entertainment（2024年7月14日簽約，前為 YG Entertainment）
- 職業：模特兒、演員、MC
- 象徵：豹🐆（粉絲貼豹圖他點讚，默認的默契）
- 粉絲名：혁미（赫迷），台灣站長自取，源自台灣飯

【模特兒出道】
- 2006年以設計師鄭旭俊（Lone Costume）服裝秀出道
- 與 G-Dragon、Kim Woo-bin 同期
- 曾走巴黎、倫敦等國際時裝週
- 代表品牌：Balenciaga、Balmain、JUUN.J、Wooyoungmi、Solid Homme、MESSIKA（珠寶大使）

【演員出道】
- 正式演員出道：2010年11月4日，電影《依帕內瑪少年》（이파네마 소년）

【重要作品】
- 2011《White Christmas》電視劇，KBS，心理校園劇
- 2011《吸血鬼偶像》電視劇，喜劇
- 2012《醜男大作戰》電影（台灣譯名），又名《車警官》
- 2013《鯊魚》電視劇，與 Kim Nam-gil 合作
- 2014《高校處世王》電視劇
- 2015《夜行書生》電視劇，MBC，飾演吸血鬼反派「鬼」，獲 MBC 演技大賞男子新人獎
- 2016《好運羅曼史》電視劇
- 2020《Born Again／重生》電視劇，飾演檢察官金秀赫
- 2021《管道 Pipeline》電影，犯罪動作
- 2021《某一天滅亡來到我家門前》電視劇，飾演出版社室長車主益，海外人氣大增
- 2022《歡迎光臨休南洞書店》廣播劇
- 2022《還有明天》電視劇，飾演死神組長朴重吉
- 2024《于氏王后》電視劇，古裝權力劇
- 2025《파란／Lost》電影，心理懸疑
- 2025《S LINE》電視劇，黑暗奇幻
- 2026《Sister》電影，黑暗犯罪

【重要活動】
- 2025年11月21日：杭州粉絲見面會（時隔10年官方見面會 #1）
- 2026年5月30日：上海粉絲見面會（#2）
- 2026年5月31日：弘大生日咖啡廳，韓粉慶生
- 2026年6月9日：MESSIKA 珠寶大使活動

【兵役】
- 2017年1月入伍，2018年11月26日退伍（社會服務要員）
`;

  /* ── 建立 UI ── */
  function createUI() {
    const style = document.createElement('style');
    style.textContent = `
      #lsh-bubble-btn {
        position: fixed; bottom: 28px; right: 28px; z-index: 9999;
        width: 52px; height: 52px; border-radius: 50%;
        background: #0a0a0f;
        border: 1px solid rgba(226,201,126,0.5);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(226,201,126,0.15);
        transition: all 0.25s ease; font-size: 22px;
      }
      #lsh-bubble-btn:hover {
        border-color: #e2c97e;
        box-shadow: 0 4px 24px rgba(226,201,126,0.25), 0 0 0 1px rgba(226,201,126,0.3);
        transform: scale(1.06);
      }
      #lsh-chat-panel {
        position: fixed; bottom: 92px; right: 28px; z-index: 9998;
        width: 340px; max-width: calc(100vw - 40px);
        background: #0e0e16;
        border: 1px solid rgba(226,201,126,0.25);
        border-radius: 12px;
        overflow: hidden;
        display: none; flex-direction: column;
        box-shadow: 0 8px 40px rgba(0,0,0,0.6);
        font-family: 'Noto Sans KR', 'Noto Sans TC', sans-serif;
      }
      #lsh-chat-panel.open { display: flex; }
      .lsh-panel-head {
        padding: 14px 18px;
        border-bottom: 1px solid rgba(226,201,126,0.15);
        display: flex; align-items: center; justify-content: space-between;
      }
      .lsh-panel-title {
        font-size: 13px; letter-spacing: 0.12em;
        color: #e2c97e; font-weight: 400;
      }
      .lsh-panel-sub {
        font-size: 10px; color: rgba(240,232,208,0.35);
        letter-spacing: 0.1em; margin-top: 2px;
      }
      .lsh-close-btn {
        background: none; border: none; color: rgba(240,232,208,0.35);
        cursor: pointer; font-size: 18px; line-height: 1;
        transition: color 0.2s; padding: 0;
      }
      .lsh-close-btn:hover { color: #e2c97e; }
      #lsh-messages {
        flex: 1; overflow-y: auto; padding: 14px;
        display: flex; flex-direction: column; gap: 10px;
        max-height: 320px; min-height: 120px;
        scrollbar-width: thin;
        scrollbar-color: rgba(226,201,126,0.2) transparent;
      }
      .lsh-msg {
        font-size: 13px; line-height: 1.65;
        padding: 10px 14px; border-radius: 8px;
        max-width: 92%;
        animation: lshFadeIn 0.2s ease;
      }
      @keyframes lshFadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; } }
      .lsh-msg.bot {
        background: rgba(226,201,126,0.07);
        border: 1px solid rgba(226,201,126,0.15);
        color: rgba(240,232,208,0.85);
        align-self: flex-start;
      }
      .lsh-msg.user {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        color: rgba(240,232,208,0.7);
        align-self: flex-end;
      }
      .lsh-msg.typing {
        background: rgba(226,201,126,0.05);
        border: 1px solid rgba(226,201,126,0.1);
        color: rgba(226,201,126,0.5);
        align-self: flex-start;
        letter-spacing: 0.2em;
      }
      .lsh-suggestions {
        padding: 0 14px 10px;
        display: flex; flex-wrap: wrap; gap: 6px;
      }
      .lsh-sug-btn {
        font-size: 11px; padding: 4px 10px;
        border: 1px solid rgba(226,201,126,0.2);
        border-radius: 12px; background: transparent;
        color: rgba(226,201,126,0.6); cursor: pointer;
        transition: all 0.2s; font-family: inherit;
        letter-spacing: 0.06em;
      }
      .lsh-sug-btn:hover {
        border-color: rgba(226,201,126,0.5);
        color: #e2c97e; background: rgba(226,201,126,0.07);
      }
      .lsh-input-row {
        padding: 12px 14px;
        border-top: 1px solid rgba(226,201,126,0.1);
        display: flex; gap: 8px;
      }
      #lsh-input {
        flex: 1; padding: 8px 12px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(240,232,208,0.12);
        border-radius: 6px; color: rgba(240,232,208,0.85);
        font-size: 13px; outline: none;
        font-family: inherit;
        transition: border-color 0.2s;
      }
      #lsh-input:focus { border-color: rgba(226,201,126,0.4); }
      #lsh-input::placeholder { color: rgba(240,232,208,0.25); }
      #lsh-send-btn {
        width: 36px; height: 36px; border-radius: 6px;
        border: 1px solid rgba(226,201,126,0.3);
        background: rgba(226,201,126,0.08);
        color: #e2c97e; cursor: pointer; font-size: 16px;
        transition: all 0.2s; display: flex;
        align-items: center; justify-content: center;
      }
      #lsh-send-btn:hover { background: rgba(226,201,126,0.18); }
      #lsh-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    `;
    document.head.appendChild(style);

    /* 氣泡按鈕 */
    const btn = document.createElement('button');
    btn.id = 'lsh-bubble-btn';
    btn.innerHTML = '🐆';
    btn.title = '問問小赫迷 AI';
    btn.onclick = togglePanel;
    document.body.appendChild(btn);

    /* 聊天面板 */
    const panel = document.createElement('div');
    panel.id = 'lsh-chat-panel';
    panel.innerHTML = `
      <div class="lsh-panel-head">
        <div>
          <div class="lsh-panel-title">🐆 小赫迷 AI</div>
          <div class="lsh-panel-sub">問我關於이수혁的一切！</div>
        </div>
        <button class="lsh-close-btn" onclick="document.getElementById('lsh-chat-panel').classList.remove('open')">✕</button>
      </div>
      <div id="lsh-messages"></div>
      <div class="lsh-suggestions" id="lsh-suggestions">
        <button class="lsh-sug-btn" onclick="sendQ('鬼是哪部戲？')">鬼是哪部戲？</button>
        <button class="lsh-sug-btn" onclick="sendQ('他什麼時候去巴黎走秀？')">巴黎走秀？</button>
        <button class="lsh-sug-btn" onclick="sendQ('台灣飯咪是哪年？')">台灣飯咪？</button>
        <button class="lsh-sug-btn" onclick="sendQ('他幾歲？')">他幾歲？</button>
      </div>
      <div class="lsh-input-row">
        <input id="lsh-input" placeholder="問我關於이수혁的事…" autocomplete="off"
          onkeydown="if(event.key==='Enter')document.getElementById('lsh-send-btn').click()"/>
        <button id="lsh-send-btn" onclick="lshSend()">→</button>
      </div>
    `;
    document.body.appendChild(panel);

    /* 開場白 */
    addMsg('bot', '안녕하세요！我是小赫迷 AI 🐆<br>你可以問我關於이수혁的作品、活動、大小事！');
  }

  /* ── 互動函數 ── */
  window.togglePanel = function () {
    document.getElementById('lsh-chat-panel').classList.toggle('open');
  };

  window.sendQ = function (q) {
    document.getElementById('lsh-input').value = q;
    lshSend();
  };

  window.lshSend = async function () {
    const input = document.getElementById('lsh-input');
    const sendBtn = document.getElementById('lsh-send-btn');
    const q = input.value.trim();
    if (!q) return;

    input.value = '';
    sendBtn.disabled = true;
    addMsg('user', q);

    /* 隱藏建議 */
    document.getElementById('lsh-suggestions').style.display = 'none';

    const typing = addMsg('typing', '···');

    try {
      const res = await fetch(CLAUDE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 400,
          system: LSH_CONTEXT,
          messages: [{ role: 'user', content: q }],
        }),
      });

      const data = await res.json();
      typing.remove();

      if (data.content && data.content[0]) {
        addMsg('bot', data.content[0].text.replace(/\n/g, '<br>'));
      } else {
        addMsg('bot', '抱歉，暫時連不上，稍後再試試看！');
      }
    } catch (e) {
      typing.remove();
      addMsg('bot', '連線失敗了，請稍後再試 🙏');
    }

    sendBtn.disabled = false;
    input.focus();
  };

  function addMsg(type, html) {
    const msgs = document.getElementById('lsh-messages');
    const div = document.createElement('div');
    div.className = 'lsh-msg ' + type;
    div.innerHTML = html;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  /* ── 初始化 ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createUI);
  } else {
    createUI();
  }

})();

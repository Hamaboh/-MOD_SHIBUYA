/* #MOD_SHIBUYA 発生記録 — ページ生成スクリプト
 * ブラウザ上で実行して index.html を生成するためのモジュール。
 *   MOD.generate(posts, topics, meta) -> index.html の文字列
 * posts : posts.json の配列 {id,u,h,n,t,x,q,m,v}
 * topics: topics.json の配列 {day,title,points[],refs[]}
 * meta  : {updated, coverage, posts}
 */
(function (root) {
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const rich = function (t) {
    let e = esc(t || '');
    e = e.replace(/(https?:\/\/[^\s]+)/g, '<a class="lnk" href="$1" target="_blank" rel="noopener">$1</a>');
    e = e.replace(/(#[A-Za-z0-9_ぁ-ゟ゠-ヿ一-龯ー]+)/g, '<span class="tag">$1</span>');
    e = e.replace(/(^|[^A-Za-z0-9_])(@[A-Za-z0-9_]{1,15})/g, '$1<span class="mention">$2</span>');
    return e.replace(/\n/g, '<br>');
  };
  const jst = iso => new Date(new Date(iso).getTime() + 9 * 3600000);
  const DAYS = ['9/8','9/9','9/10','9/11','9/12','9/13','9/14'];
  const DL = {
    '9/8':['DAY 1','火','11:30–23:00'], '9/9':['DAY 2','水','11:30–23:00'],
    '9/10':['DAY 3','木','11:30–23:00'], '9/11':['DAY 4','金','11:30–24:00'],
    '9/12':['DAY 5','土','24時間'], '9/13':['DAY 6','日','24時間'],
    '9/14':['DAY 7','月','00:00–08:00']
  };
  const CSS = String.raw`

:root{--k:#000;--w:#fff;--y:#ffe500;--y2:#ffd400;--dim:#8a8a8a;
--pop:"M PLUS Rounded 1c","Kosugi Maru","Hiragino Maru Gothic ProN","Rounded Mplus 1c",sans-serif;
--body:"Meiryo UI",Meiryo,"Hiragino Kaku Gothic ProN","Yu Gothic UI",sans-serif;}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--k);color:var(--y);font-family:var(--body);font-size:15px;line-height:1.85;-webkit-font-smoothing:antialiased}
a{color:var(--y)}
.wrap{max-width:880px;margin:0 auto;padding:0 18px}
.hero{background:var(--w);padding-block:54px 42px;border-bottom:8px solid var(--k)}
.kicker{font-family:var(--pop);font-weight:700;font-size:13px;letter-spacing:.22em;color:var(--k);margin:0 0 14px}
h1{font-family:var(--pop);font-weight:800;margin:0;line-height:1.06;font-size:clamp(38px,10vw,84px);color:var(--y);-webkit-text-stroke:3px var(--k);paint-order:stroke fill;text-shadow:6px 6px 0 var(--k);word-break:break-word}
.lead{margin:26px 0 0;color:var(--k);font-size:15px;max-width:62ch}
.hero-meta{margin-top:22px;display:flex;flex-wrap:wrap;gap:8px}
.chip{font-family:var(--pop);font-weight:700;font-size:12px;background:var(--k);color:var(--y);padding:5px 12px;border-radius:999px;white-space:nowrap}
.strip{background:var(--y);color:var(--k);font-family:var(--pop);font-weight:800;font-size:13px;letter-spacing:.14em;padding:9px 0;overflow:hidden;white-space:nowrap;border-bottom:8px solid var(--k)}
.strip span{display:inline-block;padding-right:40px}
.info{padding-block:40px}
.info h2{font-family:var(--pop);font-weight:800;font-size:clamp(22px,4.4vw,30px);margin:0 0 18px;color:var(--y)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.card{border:2px solid var(--y);border-radius:14px;padding:14px 16px;background:#0a0a0a}
.card dt{font-family:var(--pop);font-weight:700;font-size:12px;letter-spacing:.1em;color:var(--y2);margin:0 0 4px}
.card dd{margin:0;font-size:14px;color:var(--w)}
.note{color:var(--dim);font-size:12.5px;margin-top:18px;line-height:1.7}
.nav{position:sticky;top:0;z-index:20;background:var(--k);border-block:2px solid var(--y);padding:9px 0;overflow-x:auto}
.nav-in{display:flex;gap:7px;min-width:max-content}
.nav a{font-family:var(--pop);font-weight:700;font-size:13px;text-decoration:none;border:2px solid var(--y);border-radius:999px;padding:3px 13px;white-space:nowrap}
.nav a:hover{background:var(--y);color:var(--k)}
.day{padding-block:38px 10px;border-top:2px dashed #3a3a00}
.day:first-of-type{border-top:0}
.day-head{display:flex;align-items:baseline;flex-wrap:wrap;gap:10px;margin-bottom:18px}
.daytag{font-family:var(--pop);font-weight:800;font-size:12px;background:var(--y);color:var(--k);padding:3px 11px;border-radius:6px;letter-spacing:.1em}
.dayname{font-family:var(--pop);font-weight:800;font-size:clamp(28px,7vw,46px);margin:0;line-height:1}
.wd{font-size:.5em;margin-left:4px}
.dayhours,.daycount{font-size:12px;color:var(--dim)}
.topics{background:var(--w);border-radius:16px;padding:20px 22px 22px;margin-bottom:26px;box-shadow:7px 7px 0 var(--y)}
.topics-h{font-family:var(--pop);font-weight:800;font-size:19px;color:var(--y);-webkit-text-stroke:1.6px var(--k);paint-order:stroke fill;margin-bottom:12px;letter-spacing:.06em}
.topic+.topic{margin-top:16px;border-top:2px dotted #ddd;padding-top:14px}
.topic-t{font-family:var(--pop);font-weight:700;font-size:16px;color:var(--k);margin:0 0 6px}
.topic-l{margin:0;padding-left:1.15em;color:var(--k);font-size:14px}
.topic-l li{margin:3px 0}
.topics .tag{color:#b58900}.topics .mention{color:#b58900}
.refs{margin-top:8px;font-size:12px;color:#555}
.reflink{color:#000;font-weight:bold;text-decoration:underline;margin-right:6px}
.post{display:grid;grid-template-columns:64px 1fr;gap:14px;padding:16px 0;border-top:1px solid #2a2a00}
.post:first-child{border-top:0}
.post-time{font-family:var(--pop);font-weight:700;font-size:14px;color:var(--y2);padding-top:1px}
.post-head{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-bottom:5px}
.pname{font-family:var(--pop);font-weight:700;font-size:14px;color:var(--w)}
.phandle{font-size:12px;color:var(--dim)}
.badge{font-size:10.5px;border:1px solid var(--y2);border-radius:5px;padding:0 6px;color:var(--y2)}
.ptext{font-size:14.5px;word-break:break-word}
.quote{margin:9px 0 0;padding:9px 12px;border-left:3px solid var(--y2);background:#0d0d0d;font-size:13px;color:#ddd}
.tag{color:#fff}.mention{color:var(--y2)}.lnk{word-break:break-all}
.src{display:inline-block;margin-top:7px;font-family:var(--pop);font-weight:700;font-size:12px;text-decoration:none;border-bottom:2px solid var(--y)}
.src:hover{background:var(--y);color:var(--k)}
.empty{color:var(--dim);font-size:13px}
footer{background:var(--w);margin-top:44px;padding-block:34px;border-top:8px solid var(--k)}
footer .ft{font-family:var(--pop);font-weight:800;font-size:clamp(20px,5vw,34px);color:var(--y);-webkit-text-stroke:2.4px var(--k);paint-order:stroke fill;margin:0 0 12px}
footer p{color:var(--k);font-size:12.5px;margin:5px 0;line-height:1.75}
footer a{color:var(--k)}
@media(max-width:560px){.post{grid-template-columns:52px 1fr;gap:10px}.topics{padding:16px 16px 18px;box-shadow:5px 5px 0 var(--y)}}
`.replace(/^\n+/, '');

  const EXTRA = '\n.ell{color:var(--y2);font-weight:bold}\n.badge.exc{opacity:.75}\n.policy{border:2px solid var(--y2);border-radius:12px;padding:12px 16px;margin-top:16px;color:var(--w);font-size:13px;line-height:1.8}\n.policy b{color:var(--y)}\n';
  const POLICY = '<div class="policy"><b>掲載方針</b><br>本ページの主たる内容は、Xの公開投稿をもとに編集者がまとめた「トピック」です。個別の投稿については、<b>主催者・出演者・参加アーティスト・協力企業などの告知投稿は告知内容をそのまま掲載</b>し、<b>それ以外の一般の投稿は冒頭の抜粋のみ</b>を掲載しています（<span class="badge exc">抜粋</span>表示）。全文は各投稿のリンク先（X）でご覧ください。画像・動画は転載していません。</div>';

  function generate(posts, topics, meta) {
    const items = posts.slice().sort((a, b) => (a.t < b.t ? -1 : 1));
    const byDay = {}, tByDay = {};
    items.forEach(p => {
      const d = jst(p.t);
      const k = (d.getUTCMonth() + 1) + '/' + d.getUTCDate();
      (byDay[k] = byDay[k] || []).push(p);
    });
    topics.forEach(t => { (tByDay[t.day] = tByDay[t.day] || []).push(t); });

    const OFF = new Set(['_RAY_world','__yuuaself__','moonseamao','tsumugi_3510','harune__yuki','melonchan0924','kinopo_idol','mico_kinopo','Oaiko_info','ikeshibu_tokyo','wpp_ikebe','MasahiroTOBITA','yuta_hoshi','wozniaktokyo','kazuminamba','tottemogenkiman','teradann','rin_utero','pupa_info','ami_pupa','yuino_pupa','boromaru_staff','shiawase_ito','borotchi','kozue_BRGH','uno_BRGH','BRGHead','kemta','nancy_jpn','Yava_kouteca5','ktcgf_jpn','fumiki_ymgch','hibi_undrcrrnt','apes_band','pudelhunds03','tbt_hn','yotsumototakuya','sotaro_ishida','schoollabel','masasa1to','nrn_sleep_zzz','kagjun','Total_Feedback','Gday_official','NaNoMoRaL_info','pupa11music','shinobu_shami','tower_shinjuku']);
    const isOff = p => OFF.has(String(p.h || '').slice(1));
    const LIM = 110, CUT = 80;
    const body = p => { const t = String(p.x || '').trim();
      return (isOff(p) || t.length <= LIM) ? rich(t) : rich(t.slice(0, CUT).replace(/\s+$/, '')) + '<span class="ell">…</span>'; };
    const exb = p => (!isOff(p) && String(p.x || '').trim().length > LIM) ? '<span class="badge exc">抜粋</span>' : '';
    const badge = p => (p.m ? '<span class="badge">画像 ' + p.m + '</span>' : '') +
                       (p.v ? '<span class="badge">動画</span>' : '');
    const ph = p => {
      const d = jst(p.t);
      const hm = ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
      return '<article class="post" id="p' + p.id + '"><div class="post-time"><time datetime="' + p.t + '">' + hm +
        '</time></div><div class="post-body"><div class="post-head"><span class="pname">' + esc(p.n || '') +
        '</span><span class="phandle">' + esc(p.h || '') + '</span>' + badge(p) + exb(p) + '</div><div class="ptext">' +
        body(p) + '</div>' + ((p.q && isOff(p)) ? '<blockquote class="quote">' + rich(p.q) + '</blockquote>' : '') +
        '<a class="src" href="' + p.u + '" target="_blank" rel="noopener">▸ Xの投稿を見る（一次情報）</a></div></article>';
    };

    let secs = '', nav = '';
    DAYS.forEach(d => {
      const ps = byDay[d] || [], tp = tByDay[d] || [];
      if (!ps.length && !tp.length) return;
      const L = DL[d], anc = d.replace('/', '-');
      nav += '<a href="#day' + anc + '">' + d + '</a>';
      let tb = '';
      tp.forEach(t => {
        const pts = (t.points || []).map(x => '<li>' + rich(x) + '</li>').join('');
        const refs = (t.refs && t.refs.length)
          ? '<div class="refs">該当投稿：' + t.refs.map((r, i) => '<a class="reflink" href="#p' + r + '">出典' + (i + 1) + '</a>').join('') + '</div>'
          : '';
        tb += '<div class="topic"><h3 class="topic-t">' + esc(t.title) + '</h3><ul class="topic-l">' + pts + '</ul>' + refs + '</div>';
      });
      const th = tb ? '<div class="topics"><div class="topics-h">トピック</div>' + tb + '</div>' : '';
      secs += '<section class="day" id="day' + anc + '"><div class="day-head"><span class="daytag">' + L[0] +
        '</span><h2 class="dayname">' + d + '<span class="wd">（' + L[1] + '）</span></h2><span class="dayhours">' +
        L[2] + '</span><span class="daycount">収集 ' + ps.length + '件</span></div>' + th + '<div class="posts">' +
        (ps.map(ph).join('') || '<p class="empty">この日の収集済み投稿はまだありません。</p>') + '</div></section>';
    });

    const U = meta.updated, C = items.length;
    return '<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>#MOD_SHIBUYA 発生記録 ｜ RAY presents</title>\n' +
      '<meta name="description" content="アイドルグループRAY主催のカルチャー・イベント「#MOD_SHIBUYA」（9/8-14 OPENBASE SHIBUYA）で何が起きているかを、Xの投稿から時系列でまとめた非公式アーカイブ。">\n' +
      '<meta property="og:title" content="#MOD_SHIBUYA 発生記録">\n' +
      '<meta property="og:description" content="RAY presents「#MOD_SHIBUYA」で起きていることを時系列で。">\n' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      '<link href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@700;800&family=Kosugi+Maru&display=swap" rel="stylesheet">\n' +
      '<style>\n' + CSS + EXTRA + '</style>\n</head>\n<body>\n' +
      '<header class="hero"><div class="wrap"><p class="kicker">RAY presents ／ 非公式アーカイブ</p><h1>#MOD_SHIBUYA<br>発生記録</h1>' +
      '<p class="lead">アイドル・グループ <strong>RAY</strong> が渋谷で仕掛ける1週間ぶっ通しのカルチャー・イベント「#MOD_SHIBUYA」。現地にいない人にも「いま何が起きているのか」が分かるように、Xに投稿された <strong>#MOD_SHIBUYA</strong> の記録を時系列で並べたページです。各トピックと各投稿には、一次情報であるXの投稿へのリンクを付けています。一般の方の投稿は抜粋のみを掲載しています。</p>' +
      '<div class="hero-meta"><span class="chip">2026.9.8 TUE – 9.14 MON</span><span class="chip">OPENBASE SHIBUYA</span><span class="chip">入場無料・投げ銭歓迎</span><span class="chip">最終更新 ' + U + ' JST</span><span class="chip">収集 ' + C + ' 投稿</span></div></div></header>' +
      '<div class="strip"><span>渋谷を M O D （改造）する ★ カルチャー的なんでもあり ★ 1週間ぶっ通し ★ 最終3日間は69時間連続 ★ 渋谷を M O D （改造）する ★ カルチャー的なんでもあり ★ 1週間ぶっ通し ★ 最終3日間は69時間連続</span></div>' +
      '<div class="wrap info"><h2>イベント概要</h2><div class="grid">' +
      '<dl class="card"><dt>WHAT</dt><dd>RAY主催のカルチャー・イベント。展示／ライヴ／トーク／ポップアップを軸に「カルチャー的なんでもあり」を掲げ、渋谷をMOD（改造）する。飛び入り参加も歓迎。</dd></dl>' +
      '<dl class="card"><dt>WHEN</dt><dd>9/8(火)–10(木) 11:30–23:00<br>9/11(金) 11:30–24:00<br>9/12(土)–13(日) 24時間<br>9/14(月) 00:00–08:00<br>※最終3日間は69時間ぶっ通し</dd></dl>' +
      '<dl class="card"><dt>WHERE</dt><dd>OPENBASE SHIBUYA<br>東京都渋谷区宇田川町14-13（ハンズとPARCOのあいだ／渋谷駅から徒歩5分）<br>連動企画：ワールドペダルパーク（イケシブ）渋谷区道玄坂1-7-4</dd></dl>' +
      '<dl class="card"><dt>WHO</dt><dd>RAY（内山結愛・月海まお・紬実詩・春音友希ほか。メンバーは常に誰かが在場予定）／Masahiro Tobita／星優太(WOZNIAK)／Noise(BoB).（月海まお from RAY）／石田想太朗(カラコルムの山々)／ぼっちぼろまる／BELLRING少女ハート／南波一海／寺田寛明／UTERO／ピューパ!! ほか</dd></dl>' +
      '</div><p class="note">※このページはファンによる非公式のまとめです。最新・正確な情報は主催者およびRAY公式の発信をご確認ください。</p>' + POLICY + '</div>' +
      '<nav class="nav"><div class="wrap nav-in">' + nav + '</div></nav><main class="wrap">' + secs + '</main>' +
      '<footer><div class="wrap"><p class="ft">#MOD_SHIBUYA</p><p>Xハッシュタグ <strong>#MOD_SHIBUYA</strong> の公開投稿を収集して生成した非公式アーカイブ。</p>' +
      '<p>収集タイミング：毎日 18:00 / 21:00 / 24:00 / 09:00（JST）｜収集終了：2026年9月14日(月) 09:00</p>' +
      '<p>最終更新：' + U + ' JST ／ 収集済み ' + C + ' 投稿' + (meta.coverage ? '（収集範囲：' + esc(meta.coverage) + '）' : '') + '</p>' +
      '<p><strong>掲載の削除について</strong>：ご自身の投稿の掲載を希望されない場合は、<a href="https://github.com/Hamaboh/-MOD_SHIBUYA/issues" target="_blank" rel="noopener">GitHubのIssue</a>よりご連絡ください。確認のうえ速やかに削除します。</p>' +
      '<p>出典：各投稿のリンク先（X）、<a href="https://skream.jp/news/2026/08/ray_mod_shibuya.php" target="_blank" rel="noopener">Skream!</a>、<a href="https://www.ikebe-gakki.com/blog/202609-mod-shibuya/" target="_blank" rel="noopener">イケベ楽器店</a></p></div></footer>\n</body>\n</html>';
  }

  root.MOD = { generate: generate, esc: esc, rich: rich, jst: jst, DAYS: DAYS, DL: DL, CSS: CSS };
})(window);

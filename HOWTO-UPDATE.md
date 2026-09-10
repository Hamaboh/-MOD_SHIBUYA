# 更新手順（Claude 用ランブック）

このリポジトリは **Claude（Cowork）が Brave / Chrome 拡張経由で GitHub Web UI にコミットする**前提で運用する。
git push は使えない（セッションのgitプロキシがこのリポジトリへの書き込みを許可しないため）。

## 前提条件

1. **Brave（Claude in Chrome 拡張）が起動していて、対象タブが最前面（`document.visibilityState === "visible"`）であること。**
   背面・最小化だと Chrome のバックグラウンド制限で X の無限スクロールが 1 件も進まない。
2. 拡張のサイト権限で `x.com` と `github.com` が許可されていること。
3. X（x.com）にログイン済みであること。

## 手順

### 1. 既存データの取得

```
curl -s https://raw.githubusercontent.com/Hamaboh/-MOD_SHIBUYA/main/posts.json
curl -s https://raw.githubusercontent.com/Hamaboh/-MOD_SHIBUYA/main/topics.json
```

`posts.json` の最新 `t`（UTC）が前回の収集到達点。

### 2. X から新規投稿を収集

検索URL（`since_time` / `until_time` は UNIX 秒。JST の日境界は UTC+9 で計算する）:

```
https://x.com/search?q=%23MOD_SHIBUYA%20since_time%3A<from>%20until_time%3A<to>&f=live
```

ページに以下を注入してスクロール収集する（localStorage キー `__mod` に蓄積）。

```js
window.__load=()=>{try{return JSON.parse(localStorage.getItem('__mod')||'{}')}catch(e){return{}}};
window.__save=o=>localStorage.setItem('__mod',JSON.stringify(o));
window.__acc=window.__load();
window.__grab=function(){const acc=window.__acc;let n=0;
 document.querySelectorAll('article[data-testid="tweet"]').forEach(a=>{
  const t=a.querySelector('time'); if(!t)return;
  const link=t.closest('a'); const href=link?link.getAttribute('href'):null;
  if(!href||!href.includes('/status/'))return;
  const id=href.split('/status/')[1].split('/')[0]; if(!id)return;
  const handle=href.split('/')[1];
  const nameEl=a.querySelector('div[data-testid="User-Name"]');
  const txtEl=a.querySelector('div[data-testid="tweetText"]');
  const imgs=[...a.querySelectorAll('img[src*="/media/"]')].length;
  const vid=a.querySelector('div[data-testid="videoPlayer"]')?1:0;
  const qt=a.querySelector('div[role="link"] div[data-testid="tweetText"]');
  if(!acc[id]){acc[id]={id,u:'https://x.com/'+handle+'/status/'+id,h:'@'+handle,
    n:nameEl?nameEl.innerText.split('\n')[0]:'',t:t.getAttribute('datetime'),
    x:txtEl?txtEl.innerText:'',q:qt?qt.innerText:'',m:imgs,v:vid};n++;}});
 if(n)window.__save(acc); return n;};
window.__run=function(){if(window.__iv)clearInterval(window.__iv);
 window.__done=false;window.__stall=0;window.__lastH=0;window.scrollTo(0,0);
 window.__iv=setInterval(()=>{const b=Object.keys(window.__acc).length;window.__grab();
  const af=Object.keys(window.__acc).length,H=document.body.scrollHeight;
  const bottom=(window.scrollY+window.innerHeight)>=H-400;
  if(af===b&&H===window.__lastH&&bottom){window.__stall++}else{window.__stall=0}
  window.__lastH=H;
  if(window.__stall>60){clearInterval(window.__iv);window.__done=true;window.__save(window.__acc);return}
  if(bottom){window.scrollBy(0,-250)}else{window.scrollBy(0,window.innerHeight*0.55)}},500);
 return 'running'};
window.__run();
```

X の検索タイムラインは 1 回のスクロールで概ね 30 件前後で止まることがあるため、
**取りこぼしたら時間窓を狭めて（1〜3時間単位で）再実行する**。

### 3. x.com → github.com へのデータ受け渡し

同一タブでの `window.name` は cross-site 遷移で消える。クリップボードの貼り付けも
CDP 合成キーでは発火しない。**`window.open` + `postMessage` を使う。**

x.com 側（ボタンを置き、`computer left_click` で押す＝ユーザー操作扱いにする）:

```js
window.__data=JSON.stringify(Object.values(JSON.parse(localStorage.getItem('__mod'))).sort((a,b)=>a.t<b.t?-1:1));
const b=document.createElement('button');
b.style.cssText='position:fixed;left:40%;top:40%;width:240px;height:90px;z-index:2147483647';
b.textContent='OPEN';
b.onclick=function(){
  window.__w=window.open('https://github.com/Hamaboh/-MOD_SHIBUYA/upload/main','_blank');
  window.__iv2=setInterval(()=>{try{window.__w.postMessage(window.__data,'https://github.com')}catch(e){}},600);
};
document.body.appendChild(b);
```

github.com 側（開いたタブに注入。受信できたら x.com 側の `__iv2` を止める）:

```js
window.__got=null;
window.addEventListener('message',e=>{
  if(e.origin==='https://x.com'&&typeof e.data==='string'&&e.data.length>1000){window.__got=e.data}
});
```

### 4. index.html の生成

github.com のタブで `generator.js` を読み込み、`MOD.generate(posts, topics, meta)` を呼ぶ。

```js
await fetch('https://raw.githubusercontent.com/Hamaboh/-MOD_SHIBUYA/main/generator.js')
  .then(r=>r.text()).then(t=>eval(t));
const posts=JSON.parse(window.__got);
const html=MOD.generate(posts, topics, meta);
```

`meta` は `{updated:'YYYY/MM/DD HH:MM', coverage:'...', posts:<件数>}`（すべて JST 表記）。
`topics[].refs` は投稿IDの完全一致で指定する（`posts[].id`）。

### 5. コミット

`https://github.com/Hamaboh/-MOD_SHIBUYA/upload/main` のファイル入力に `DataTransfer` で File を流し込む。
`change` を dispatch すると GitHub 側が受け取り、input は空に戻る（＝正常）。

```js
const inp=document.querySelector('input[type=file]');
const dt=new DataTransfer();
dt.items.add(new File([html],'index.html',{type:'text/html'}));
dt.items.add(new File([JSON.stringify(posts,null,1)],'posts.json',{type:'application/json'}));
dt.items.add(new File([JSON.stringify(meta,null,1)],'meta.json',{type:'application/json'}));
inp.files=dt.files;
inp.dispatchEvent(new Event('change',{bubbles:true}));
```

コミットメッセージを `input[name="message"]` に **ネイティブ setter 経由**で入れてから
`Commit changes` を押す（React 制御下のため通常代入では反映されない）。

```js
const nat=(el,v)=>{Object.getOwnPropertyDescriptor(el.constructor.prototype,'value').set.call(el,v);
  el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
```

### 6. 検証

```
curl -s -o /dev/null -w "%{http_code}" https://hamaboh.github.io/-MOD_SHIBUYA/
```

Pages の反映には概ね 1 分前後かかる。投稿件数・日別セクション・出典リンク数を確認する。

## 収集スケジュール

毎日 **18:00 / 21:00 / 24:00 / 09:00（JST）**、**2026年9月14日(月) 09:00 で終了**。
前提条件が揃わず失敗した回はスキップし、次回に前回分をまとめて収集する。

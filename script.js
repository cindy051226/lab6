// ---------- Data for each country page ----------
const COUNTRIES = [
  { id:"japan",    name:"Japan",    flag:"🇯🇵", code:"JPY", tip:"Convenience store meals are cheap and tasty!", daily:150 },
  { id:"usa",      name:"USA",      flag:"🇺🇸", code:"USD", tip:"Remember tax and tips get added on top.",       daily:250 },
  { id:"thailand", name:"Thailand", flag:"🇹🇭", code:"THB", tip:"Street food is the best value.",                 daily:100 },
  { id:"france",   name:"France",   flag:"🇫🇷", code:"EUR", tip:"Lunch menus are cheaper than dinner.",           daily:220 },
  { id:"uk",       name:"UK",       flag:"🇬🇧", code:"GBP", tip:"Museums are often free!",                        daily:230 },
  { id:"australia",name:"Australia",flag:"🇦🇺", code:"AUD", tip:"Tap water is safe, skip bottled water.",         daily:200 }
];
const SPLIT = [["Hotel / Stay",0.40],["Food",0.30],["Transport",0.15],["Fun & Shopping",0.15]];

// ---------- Pixel coin drawn on a canvas ----------
const COIN = [
 "..oooooo..",".oyyyyyyo.","oyyywwyyyo","oyywyyyyyo","oyywyyyyyo",
 "oyywyyyyyo","oyyyyyyyyo","oyyyyyyyyo",".oyyyyyyo.","..oooooo.."];
function drawCoin(cv){
  const c = cv.getContext("2d"), colors = {o:"#b8860b", y:"#ffd23f", w:"#fff6a8"};
  cv.width = 10; cv.height = 10;
  COIN.forEach((row,y)=>[...row].forEach((ch,x)=>{ if(colors[ch]){ c.fillStyle=colors[ch]; c.fillRect(x,y,1,1);} }));
}

// ---------- API ----------
const API = "https://api.frankfurter.dev/v1";
const cache = {};
function dateStr(d){ return d.toISOString().slice(0,10); }

async function getRates(code){
  if(cache[code]) return cache[code];
  const end = new Date(), start = new Date(); start.setDate(end.getDate()-30);
  const latestRes = await fetch(`${API}/latest?base=CAD&symbols=${code}`);
  if(!latestRes.ok) throw new Error("latest failed");
  const latest = await latestRes.json();
  const histRes = await fetch(`${API}/${dateStr(start)}..${dateStr(end)}?base=CAD&symbols=${code}`);
  if(!histRes.ok) throw new Error("history failed");
  const hist = await histRes.json();
  const vals = Object.values(hist.rates).map(r=>r[code]);
  const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
  return (cache[code] = { rate: latest.rates[code], date: latest.date, avg });
}

// ---------- Pages ----------
function buildNav(active){
  const nav = document.getElementById("nav");
  nav.innerHTML = `<button class="${active==='home'?'on':''}" data-id="home">HOME</button>` +
    COUNTRIES.map(c=>`<button class="${active===c.id?'on':''}" data-id="${c.id}">${c.flag} ${c.name}</button>`).join("");
  nav.querySelectorAll("button").forEach(b=>b.onclick=()=>{ location.hash = b.dataset.id; });
}

const PINS = { usa:[27,39], uk:[51,20], france:[55,29], thailand:[73,46], japan:[87,31], australia:[78,67] };

function drawEarth(cv){
  const N = 64, c = cv.getContext("2d");
  cv.width = N; cv.height = N;
  const land = [[18,22,9,8],[24,42,4,9],[34,16,4,3],[35,32,6,9],[46,20,10,7],[50,43,5,3.5]];
  for(let y=0;y<N;y++) for(let x=0;x<N;x++){
    const d = Math.hypot(x-31.5, y-31.5);
    if(d > 30) continue;
    let col = d > 28 ? "#14507a" : ((x+y)%7===0 ? "#2f86c7" : "#2a78b8");
    const isLand = land.some(([cx,cy,rx,ry]) => ((x-cx)/rx)**2 + ((y-cy)/ry)**2 < 1 + 0.25*Math.sin(x*1.7+y*2.3));
    if(isLand){
      const k = (x*3+y*5) % 11;
      col = k<2 ? "#c9a85c" : (k<5 ? "#4d9a45" : "#3a7d3a");
    }
    if(y<5 || y>58) col = "#e8f1f5";
    if((x*7+y*13)%37===0) col = "#ffffff";
    c.fillStyle = col; c.fillRect(x,y,1,1);
  }
}

function showHome(){
  document.getElementById("page").innerHTML = `
    <div class="box"><h2>WHERE TO?</h2>
      <p>Click a flag on the planet to see what your Canadian dollar is worth there and plan your daily budget.</p></div>
    <div class="globe">
      <canvas id="earth"></canvas>
      ${COUNTRIES.map(c=>`<button class="pin" style="left:${PINS[c.id][0]}%;top:${PINS[c.id][1]}%" data-id="${c.id}"><span>${c.flag}</span><em>${c.name}</em></button>`).join("")}
    </div>`;
  drawEarth(document.getElementById("earth"));
  document.querySelectorAll(".pin").forEach(p=>p.onclick=()=>{ location.hash = p.dataset.id; });
}

function showCountry(c){
  const page = document.getElementById("page");
  page.innerHTML = `
    <div class="box row">
      <div class="flag">${c.flag}</div>
      <div><h2>${c.name.toUpperCase()}</h2></div>
      <canvas id="coin"></canvas>
    </div>
    <div class="box">
      <h2>YOUR TRIP</h2>
      <div class="row">
        <label>Budget / day (CAD)<br><input id="daily" type="number" value="${c.daily}" step="10"></label>
        <label>Days<br><input id="days" type="number" value="5" min="1"></label>
        <button id="refresh">REFRESH</button>
      </div>
    </div>
    <div class="box" id="result">Loading rates...</div>`;
  drawCoin(document.getElementById("coin"));

  async function update(forceFresh){
    const out = document.getElementById("result");
    try{
      if(forceFresh) delete cache[c.code];
      const { rate, date, avg } = await getRates(c.code);
      const daily = +document.getElementById("daily").value || 0;
      const days = +document.getElementById("days").value || 1;
      // more foreign money per CAD than average = CAD is strong = cheap trip
      const diff = (rate-avg)/avg*100;
      let label = "FAIR", cls = "fair";
      if(diff > 1){ label = "CHEAP"; cls = "cheap"; }
      else if(diff < -1){ label = "EXPENSIVE"; cls = "expensive"; }
      const dec = rate*daily > 1000 ? 0 : 2;
      const money = n => n.toLocaleString(undefined,{maximumFractionDigits:dec}) + " " + c.code;
      out.innerHTML = `
        <h2>RESULT</h2>
        <p>100 CAD = <span class="big">${(rate*100).toFixed(2)} ${c.code}</span></p>
        <p>Trip is <span class="verdict ${cls}">${label}</span></p>
        <p>Total: ${(daily*days).toLocaleString()} CAD = <span class="big">${money(daily*days*rate)}</span></p>
        <table>${SPLIT.map(([n,p])=>`<tr><td>${n} (${p*100}%)</td><td>${money(daily*p*rate)} / day</td></tr>`).join("")}</table>`;
    }catch(err){
      out.innerHTML = "Oops! Couldn't load rates. Check your internet and press REFRESH.";
    }
  }
  document.getElementById("daily").oninput = ()=>update(false);
  document.getElementById("days").oninput = ()=>update(false);
  document.getElementById("refresh").onclick = ()=>update(true);
  update(false);
}

// ---------- Simple hash router ----------
function route(){
  const id = location.hash.slice(1) || "home";
  const c = COUNTRIES.find(x=>x.id===id);
  buildNav(c ? c.id : "home");
  c ? showCountry(c) : showHome();
}
window.addEventListener("hashchange", route);
route();

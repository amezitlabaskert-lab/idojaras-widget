(function() {
    const VERSION = "v9.8"; 

    // 1. URL PARAMÉTER FIGYELŐ (Kert-specifikus koordinátákhoz)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('lat') && urlParams.has('lon')) {
        localStorage.setItem('garden-lat', urlParams.get('lat'));
        localStorage.setItem('garden-lon', urlParams.get('lon'));
    }

    const container = document.getElementById('idojaras-widget-root');
    if (!container) return;

    // 2. HTML ÉS CSS (Tisztán, keret nélkül - a keret a HTML-ben lakik)
    container.innerHTML = `
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet" />
    <style>
        .idojaras-widget { background: #ffffff !important; padding: 15px 20px; font-family: 'Plus Jakarta Sans', sans-serif; color: #636363; box-sizing: border-box; width: 100% !important; position: relative; }
        .top-row { display: flex; justify-content: space-between; align-items: center; gap: 15px; margin-bottom: 5px; }
        .now-box { flex: 1; display: flex; align-items: center; gap: 10px; }
        .now-temp-text { font-size: 38px; font-weight: 800; letter-spacing: -1.5px; }
        .now-status-desc { font-size: 10px; font-weight: 700; color: #999; text-transform: uppercase; margin-top: -4px; }
        .forecast-mini-grid { flex: 1.5; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .mini-day-card { text-align: center; }
        .mini-day-title { font-size: 10px; font-weight: 700; color: #999; text-transform: uppercase; }
        .mini-day-icon { width: 45px; height: 45px; margin: 2px auto; }
        .mini-day-temps { font-size: 12px; font-weight: 800; }
        .temp-max { color: #e67e22; }
        .temp-min { color: #3498db; margin-left: 2px; }
        .soil-compact-row { display: flex; justify-content: space-around; background: #fdfdfd; padding: 8px 5px; margin: 10px 0 !important; border-radius: 8px; }
        .soil-item { text-align: center; flex: 1; }
        .soil-label { font-size: 9px; font-weight: 800; color: #aaa; text-transform: uppercase; }
        .soil-val { font-size: 16px; font-weight: 800; color: #555; white-space: nowrap; margin-top: 2px; display: block; }
        .chart-container { border-top: 1px solid #f0f0f0; padding-top: 10px; height: 110px; position: relative; }
        .chart-footer { display: grid; grid-template-columns: 1.2fr auto 1.2fr; align-items: center; font-size: 8px; font-weight: 800; color: #bbb; text-transform: uppercase; padding: 8px 0 0 0; margin-top: 5px; }
        .footer-left { text-align: left; }
        .footer-center { text-align: center; color: #eee; font-weight: 400; font-size: 7px; }
        .footer-right { text-align: right; }
        .weather-img { width: 100%; height: 100%; object-fit: contain; }

        @media (max-width: 480px) {
            .idojaras-widget { padding: 10px 12px; }
            .now-temp-text { font-size: 30px; }
            #now-icon-anim { width: 65px !important; height: 65px !important; }
            .soil-val { font-size: 13px; }
            .chart-container { height: 95px; }
            .chart-footer { font-size: 7px; }
        }
    </style>
    <div class="idojaras-widget">
        <div class="top-row">
            <div class="now-box"><div id="now-icon-anim" style="width: 80px; height: 80px;"></div><div class="now-info-text"><div class="now-temp-text"><span id="now-temp-val">--</span>°C</div><div id="now-status-label" class="now-status-desc">Betöltés...</div></div></div>
            <div class="forecast-mini-grid" id="daily-grid-container"></div>
        </div>
        <div class="soil-compact-row">
            <div class="soil-item"><div class="soil-label">Páratartalom</div><div id="hum-val" class="soil-val">--%</div></div>
            <div class="soil-item"><div class="soil-label">Talajnedvesség</div><div id="moist-display" class="soil-val">--%</div></div>
            <div class="soil-item"><div class="soil-label">Vízmérleg</div><div id="evapo-val" class="soil-val">-- mm</div></div>
            <div class="soil-item"><div class="soil-label">Talajhő</div><div class="soil-val"><span id="s6-val">--</span>°C</div></div>
        </div>
        <div class="chart-container"><canvas id="finalYearChart"></canvas></div>
        <div class="chart-footer">
            <div class="footer-left" id="footer-title">...</div>
            <div class="footer-center">${VERSION}</div>
            <div class="footer-right" id="chart-summary">...</div>
        </div>
    </div>`;

    // 3. CHART.JS BETÖLTÉSE HA NINCS
    if (typeof Chart === 'undefined') {
        const chartScript = document.createElement('script');
        chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        chartScript.onload = () => initWeatherLogic();
        document.head.appendChild(chartScript);
    } else {
        initWeatherLogic();
    }

    function initWeatherLogic() {
        const CONFIG = { LAT: 47.5136, LON: 19.3735, ICON_BASE_URL: "https://basmilius.github.io/weather-icons/production/fill/all/", CACHE_DURATION: 5 * 60 * 1000 };
        const DAY_NAMES = ["VAS", "HÉT", "KEDD", "SZE", "CSÜ", "PÉN", "SZO"];
        const MONTH_LABELS = ['Jan','Feb','Már','Ápr','Máj','Jún','Júl','Aug','Szep','Okt','Nov','Dec'];
        const WMO_MAP = { 0: { label: 'Derült', d: 'clear-day.svg', n: 'clear-night.svg' }, 1: { label: 'Derűs', d: 'partly-cloudy-day.svg', n: 'partly-cloudy-night.svg' }, 2: { label: 'Részben felhős', d: 'partly-cloudy-day.svg', n: 'partly-cloudy-night.svg' }, 3: { label: 'Borult', d: 'cloudy.svg', n: 'cloudy.svg' }, 45: { label: 'Ködös', d: 'fog.svg', n: 'fog.svg' }, 48: { label: 'Zúzmarás köd', d: 'fog.svg', n: 'fog.svg' }, 51: { label: 'Gyenge szitálás', d: 'drizzle.svg', n: 'drizzle.svg' }, 53: { label: 'Szitálás', d: 'drizzle.svg', n: 'drizzle.svg' }, 55: { label: 'Erős szitálás', d: 'drizzle.svg', n: 'drizzle.svg' }, 56: { label: 'Zúzmarás szitálás', d: 'drizzle.svg', n: 'drizzle.svg' }, 57: { label: 'Erős zúzmarás szitálás', d: 'drizzle.svg', n: 'drizzle.svg' }, 61: { label: 'Gyenge eső', d: 'rain.svg', n: 'rain.svg' }, 63: { label: 'Eső', d: 'rain.svg', n: 'rain.svg' }, 65: { label: 'Heves eső', d: 'extreme-rain.svg', n: 'extreme-rain.svg' }, 66: { label: 'Ónos eső', d: 'sleet.svg', n: 'sleet.svg' }, 67: { label: 'Erős ónos eső', d: 'sleet.svg', n: 'sleet.svg' }, 71: { label: 'Hószállingózás', d: 'snow.svg', n: 'snow.svg' }, 73: { label: 'Havazás', d: 'snow.svg', n: 'snow.svg' }, 75: { label: 'Erős havazás', d: 'extreme-snow.svg', n: 'extreme-snow.svg' }, 77: { label: 'Hószemcsék', d: 'snow.svg', n: 'snow.svg' }, 80: { label: 'Gyenge zápor', d: 'partly-cloudy-day-rain.svg', n: 'partly-cloudy-night-rain.svg' }, 81: { label: 'Zápor', d: 'rain.svg', n: 'rain.svg' }, 82: { label: 'Heves zápor', d: 'extreme-day-rain.svg', n: 'extreme-night-rain.svg' }, 85: { label: 'Hózápor', d: 'partly-cloudy-day-snow.svg', n: 'partly-cloudy-night-snow.svg' }, 86: { label: 'Heves hózápor', d: 'extreme-day-snow.svg', n: 'extreme-night-snow.svg' }, 95: { label: 'Zivatar', d: 'thunderstorms-day-rain.svg', n: 'thunderstorms-night-rain.svg' }, 96: { label: 'Zivatar jégesővel', d: 'thunderstorms-day-extreme.svg', n: 'thunderstorms-night-extreme.svg' }, 99: { label: 'Heves zivatar', d: 'thunderstorms-extreme-rain.svg', n: 'thunderstorms-extreme-rain.svg' } };

        let chartInstance = null;
        function showError(m) { document.getElementById('now-status-label').innerText = m; }

        async function fetchWithTimeout(url, timeout = 10000) {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { signal: controller.signal });
            clearTimeout(id);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        }

        async function updateWidget() {
            try {
                // DINAMIKUS DÁTUM KEZELÉS
                const now = new Date();
                const currYear = now.getFullYear();
                const prevYear = currYear - 1;
                const todayStr = now.toISOString().split('T')[0];

                const sLat = localStorage.getItem('garden-lat'), sLon = localStorage.getItem('garden-lon');
                const isPers = !!(sLat && sLon), lat = isPers ? Number(sLat) : CONFIG.LAT, lon = isPers ? Number(sLon) : CONFIG.LON;
                
                const res = await Promise.all([
                    fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=is_day,weather_code&hourly=temperature_2m,relative_humidity_2m,soil_temperature_6cm,soil_moisture_3_to_9cm&daily=weathercode,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration,precipitation_sum&timezone=auto&forecast_days=4`),
                    fetchWithTimeout(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${currYear}-01-01&end_date=${todayStr}&daily=precipitation_sum&timezone=auto`),
                    fetchWithTimeout(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${prevYear}-01-01&end_date=${prevYear}-12-31&daily=precipitation_sum&timezone=auto`)
                ]);

                const forecast = res[0];
                const hIdx = forecast.hourly.time.findIndex(t => new Date(t) > now) - 1;
                
                if (hIdx >= 0) {
                    document.getElementById('now-temp-val').innerText = Math.round(forecast.hourly.temperature_2m[hIdx]);
                    document.getElementById('hum-val').innerText = forecast.hourly.relative_humidity_2m[hIdx] + '%';
                    document.getElementById('moist-display').innerText = (forecast.hourly.soil_moisture_3_to_9cm[hIdx] * 100).toFixed(1) + '%';
                    document.getElementById('s6-val').innerText = forecast.hourly.soil_temperature_6cm[hIdx].toFixed(1);
                    const wInfo = WMO_MAP[forecast.current.weather_code] || WMO_MAP[0];
                    document.getElementById('now-icon-anim').innerHTML = `<img src="${CONFIG.ICON_BASE_URL}${wInfo[forecast.current.is_day?'d':'n']}" class="weather-img">`;
                    document.getElementById('now-status-label').innerText = wInfo.label;
                }

                const balance = (forecast.daily.precipitation_sum[0] || 0) - (forecast.daily.et0_fao_evapotranspiration[0] || 0);
                document.getElementById('evapo-val').innerText = (balance > 0 ? '+' : '') + balance.toFixed(1) + ' mm';

                // ÖSSZEGZÉS - Dinamikusan számolt évek alapján
                const currYearSum = res[1].daily.precipitation_sum.reduce((a, b) => a + (b || 0), 0);
                const prevYearSum = res[2].daily.precipitation_sum.reduce((a, b) => a + (b || 0), 0);
                
                const currYearData = new Array(12).fill(0), prevYearData = new Array(12).fill(0);
                res[1].daily.precipitation_sum.forEach((r, i) => { if (r) currYearData[new Date(res[1].daily.time[i]).getMonth()] += r; });
                res[2].daily.precipitation_sum.forEach((r, i) => { if (r) prevYearData[new Date(res[2].daily.time[i]).getMonth()] += r; });

                document.getElementById('footer-title').innerText = isPers ? "ÉVES CSAPADÉK A KERTEMBEN (HAVI BONTÁS)" : "ÉVES CSAPADÉK A MEZÍTLÁBAS KERTBEN (HAVI BONTÁS)";
                document.getElementById('chart-summary').innerHTML = (isPers ? '● ' : '') + `IDÉN: ${currYearSum.toFixed(0)} / TAVALY: ${prevYearSum.toFixed(0)} MM`;

                const ctx = document.getElementById('finalYearChart');
                if (chartInstance) {
                    chartInstance.data.datasets[0].data = currYearData;
                    chartInstance.data.datasets[1].data = prevYearData;
                    chartInstance.update();
                } else {
                    chartInstance = new Chart(ctx, { 
                        type: 'bar', 
                        data: { labels: MONTH_LABELS, datasets: [{ data: currYearData, backgroundColor: '#3498db' }, { data: prevYearData, backgroundColor: '#e2e8f0' }] }, 
                        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: '#bbb', font: { size: 9, weight: 'bold' } } } } } 
                    });
                }

                let gridHtml = "";
                for(let i=1; i<=3; i++) {
                    const d = new Date(forecast.daily.time[i]), dw = WMO_MAP[forecast.daily.weathercode[i]] || WMO_MAP[0];
                    gridHtml += `<div class="mini-day-card"><div class="mini-day-title">${DAY_NAMES[d.getDay()]}</div><div class="mini-day-icon"><img src="${CONFIG.ICON_BASE_URL}${dw.d}" class="weather-img"></div><div class="mini-day-temps"><span class="temp-max">${Math.round(forecast.daily.temperature_2m_max[i])}°</span><span class="temp-min">${Math.round(forecast.daily.temperature_2m_min[i])}°</span></div></div>`;
                }
                document.getElementById('daily-grid-container').innerHTML = gridHtml;

            } catch (e) { showError('Adat hiba'); console.error("Widget Error:", e); }
        }
        updateWidget();
        setInterval(updateWidget, CONFIG.CACHE_DURATION);
    }
})();

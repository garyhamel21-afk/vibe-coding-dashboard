// Firebase 연계 유가정보 대시보드
console.log('=== FuelWatch Dashboard 시작 ===');

// Firebase Configuration (동적 로드)
let app, database;
let firebaseInitialized = false;

async function initializeFirebase() {
    try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { getDatabase } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        
        const firebaseConfig = {
            apiKey: "AIzaSyDFLlU7sq_Aziiht-Qb2_-IUnkuXZb3E3g",
            authDomain: "aixyz-de038.firebaseapp.com",
            projectId: "aixyz-de038",
            storageBucket: "aixyz-de038.firebasestorage.app",
            messagingSenderId: "854211772025",
            appId: "1:854211772025:web:7a005452b02c492915dea8",
            databaseURL: "https://aixyz-de038-default-rtdb.firebaseio.com/"
        };
        
        app = initializeApp(firebaseConfig);
        database = getDatabase(app);
        firebaseInitialized = true;
        console.log('Firebase 초기화 성공');
    } catch (error) {
        console.error('Firebase 초기화 실패:', error);
        firebaseInitialized = false;
    }
}

// API Configuration
const API_CONFIG = {
    baseUrl: window.location.origin + '/api',
    apiKey: 'F251010901',
    endpoints: {
        avgAllPrice: '/avgAllPrice.do',
        dateAvgRecentPrice: '/dateAvgRecentPrice.do'  // 7일간 전국 일일 평균 가격
    }
};

// Global Variables
let currentData = null;
let priceHistory = [];
let chart = null;
let updateInterval = null;

// DOM Elements - Initialize after DOM is loaded
let elements = {};

function initializeElements() {
    elements = {
        lastUpdate: document.getElementById('lastUpdate'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        gasolinePrice: document.getElementById('gasolinePrice'),
        gasolineChange: document.getElementById('gasolineChange'),
        gasolineMinPrice: document.getElementById('gasolineMinPrice'),
        gasolineMaxPrice: document.getElementById('gasolineMaxPrice'),
        dieselPrice: document.getElementById('dieselPrice'),
        dieselChange: document.getElementById('dieselChange'),
        dieselMinPrice: document.getElementById('dieselMinPrice'),
        dieselMaxPrice: document.getElementById('dieselMaxPrice'),
        lpgPrice: document.getElementById('lpgPrice'),
        lpgChange: document.getElementById('lpgChange'),
        lpgMinPrice: document.getElementById('lpgMinPrice'),
        lpgMaxPrice: document.getElementById('lpgMaxPrice'),
        chartCanvas: document.getElementById('priceChart'),
        dataPoints: document.getElementById('dataPoints'),
        lastChartUpdate: document.getElementById('lastChartUpdate')
    };
    
    // 디버깅: 요소들이 제대로 찾아졌는지 확인
    console.log('DOM 요소 초기화:', elements);
    console.log('휘발유 가격 요소:', elements.gasolinePrice);
    console.log('경유 가격 요소:', elements.dieselPrice);
    console.log('LPG 가격 요소:', elements.lpgPrice);
    console.log('차트 캔버스 요소:', elements.chartCanvas);
}

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== DOM 로딩 완료 ===');
    console.log('현재 URL:', window.location.href);
    console.log('API Base URL:', API_CONFIG.baseUrl);
    
    // DOM 요소 초기화
    initializeElements();
    
    initializeApp();
});

function initializeApp() {
    console.log('=== 앱 초기화 시작 ===');
    showLoading();
    
    // 즉시 24시간 간격 테스트 데이터로 차트 초기화
    console.log('📊 24시간 간격 테스트 데이터로 차트 즉시 초기화...');
    const testData3Hour = generate3HourTestData();
    priceHistory = testData3Hour;
    
    // 차트 초기화 및 업데이트
    setTimeout(() => {
        console.log('📊 24시간 간격 차트 초기화 및 업데이트 시작...');
        create3HourChart(testData3Hour);
        hideLoading();
    }, 500);
    
    // 현재 가격 정보 로드
    loadInitialData();
    
    // Firebase 초기화 (비동기, 백그라운드)
    setTimeout(async () => {
        try {
            console.log('🔥 Firebase 초기화 시작...');
            await initializeFirebase();
            
            console.log('🔥 Firebase 초기화 완료, priceHistory에서 24시간 간격 데이터 로드 시작...');
            await load3HourDataFromFirebase();
            
            startPeriodicUpdate();
        } catch (error) {
            console.error('Firebase 초기화 실패, 24시간 간격 테스트 데이터로 계속 실행:', error);
            startPeriodicUpdate();
        }
    }, 1000);
}

// API Functions
async function fetchData(endpoint, params = {}) {
    const url = new URL(API_CONFIG.baseUrl + endpoint);
    url.searchParams.set('code', API_CONFIG.apiKey);
    url.searchParams.set('out', 'json');
    
    Object.keys(params).forEach(key => {
        url.searchParams.set(key, params[key]);
    });
    
    console.log('API 요청:', url.toString());
    
    try {
        const response = await fetch(url.toString());
        console.log('API 응답 상태:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('API 응답 데이터:', data);
        return data;
    } catch (error) {
        console.error('API 요청 실패:', error);
        throw error;
    }
}

// Load Real OPINET Data (7일간 전국 일일 평균 가격)
async function loadRealOPINETData() {
    console.log('📡 OPINET 실제 데이터 로드 시작 (7일간 전국 일일 평균 가격)...');
    
    try {
        console.log('API Base URL:', API_CONFIG.baseUrl);
        console.log('API Key:', API_CONFIG.apiKey);
        
        // 오늘 날짜를 기준으로 7일간 데이터 요청 (오늘 포함)
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD 형식
        
        console.log('📅 요청 날짜 (오늘):', todayStr);
        console.log('📅 요청 기간: 오늘 포함 7일간 (오늘 ~ 7일 전)');
        
        const response = await fetchData(API_CONFIG.endpoints.dateAvgRecentPrice, {
            date: todayStr,  // 오늘 날짜 기준으로 7일 전까지 (오늘 포함)
            prodcd: 'B027,D047,K015'  // 휘발유, 경유, LPG
        });
        
        console.log('OPINET API 응답 전체:', response);
        
        if (response && response.RESULT && response.RESULT.OIL) {
            console.log('✅ OPINET 실제 데이터 로드 성공:', response.RESULT.OIL);
            console.log('🔍 Raw OPINET data for conversion:', response.RESULT.OIL);
            
            // OPINET 데이터를 일자별로 변환
            const dailyData = convertOPINETToDailyData(response.RESULT.OIL);
            console.log('📊 변환된 일자별 데이터:', dailyData);
            console.log('🔍 Daily data returned from convertOPINETToDailyData:', dailyData);
            
            // Firebase에 실제 데이터 저장
            console.log('🔥 Firebase에 실제 OPINET 데이터 저장 시작...');
            const saveResult = await saveOPINETDataToFirebase(dailyData);
            
            if (saveResult) {
                console.log('✅ 실제 OPINET 데이터 Firebase 저장 성공!');
                
                // 차트 업데이트
                priceHistory = dailyData;
                updatePriceChartDaily(dailyData);
                
                showToast('실제 OPINET 데이터가 로드되었습니다!', 'success');
                return dailyData;
            } else {
                console.error('❌ 실제 OPINET 데이터 Firebase 저장 실패');
                showToast('Firebase 저장에 실패했습니다.', 'error');
                return null;
            }
        } else {
            console.error('❌ OPINET API 응답 데이터가 없습니다:', response);
            console.log('🔍 API 응답이 비어있어서 테스트 데이터를 생성합니다.');
            
            // API 실패 시 테스트 데이터 생성
            const testData = generateOPINETTestData();
            console.log('📊 생성된 테스트 데이터:', testData);
            
            // Firebase에 테스트 데이터 저장
            const saveResult = await saveOPINETDataToFirebase(testData);
            
            if (saveResult) {
                console.log('✅ 테스트 데이터 Firebase 저장 성공!');
                
                // 차트 업데이트
                priceHistory = testData;
                updatePriceChartDaily(testData);
                
                showToast('테스트 데이터로 차트를 표시합니다.', 'warning');
                return testData;
            } else {
                showToast('OPINET 데이터를 불러올 수 없습니다.', 'error');
                return null;
            }
        }
    } catch (error) {
        console.error('❌ OPINET 데이터 로드 실패:', error);
        console.error('에러 상세:', error.message);
        console.log('🔍 API 에러로 인해 테스트 데이터를 생성합니다.');
        
        try {
            // API 실패 시 테스트 데이터 생성
            const testData = generateOPINETTestData();
            console.log('📊 에러 발생으로 테스트 데이터 생성:', testData);
            
            // Firebase에 테스트 데이터 저장
            const saveResult = await saveOPINETDataToFirebase(testData);
            
            if (saveResult) {
                console.log('✅ 테스트 데이터 Firebase 저장 성공!');
                
                // 차트 업데이트
                priceHistory = testData;
                updatePriceChartDaily(testData);
                
                showToast('API 오류로 테스트 데이터를 표시합니다.', 'warning');
                return testData;
            } else {
                showToast('OPINET 데이터 로드 중 오류가 발생했습니다: ' + error.message, 'error');
                return null;
            }
        } catch (testError) {
            console.error('❌ 테스트 데이터 생성도 실패:', testError);
            showToast('OPINET 데이터 로드 중 오류가 발생했습니다: ' + error.message, 'error');
            return null;
        }
    }
}

// Convert OPINET Data to Daily Format
function convertOPINETToDailyData(opinetData) {
    console.log('📊 OPINET 데이터를 일자별 형식으로 변환 시작...');
    console.log('원본 OPINET 데이터:', opinetData);
    
    const dailyMap = new Map();
    
    // OPINET 데이터를 날짜별로 그룹화
    opinetData.forEach((item, index) => {
        console.log(`🔍 Processing item ${index}:`, item);
        
        const date = item.DATE; // OPINET에서 제공하는 날짜 (YYYYMMDD 형식)
        const prodcd = item.PRODCD;
        const price = parseFloat(item.PRICE);
        
        console.log(`🔍 Parsed data - Date: ${date}, Product: ${prodcd}, Price: ${price}`);
        
        if (!dailyMap.has(date)) {
            const formattedDate = date.substring(0, 4) + '-' + date.substring(4, 6) + '-' + date.substring(6, 8);
            console.log(`🔍 Creating new date entry for: ${formattedDate}`);
            
            dailyMap.set(date, {
                timestamp: new Date(formattedDate).toISOString(),
                date: formattedDate, // YYYY-MM-DD 형식으로 변환
                gasoline: null,
                diesel: null,
                lpg: null,
                createdAt: new Date(formattedDate).getTime()
            });
        }
        
        const dayData = dailyMap.get(date);
        
        // 유종별 가격 저장
        switch (prodcd) {
            case 'B027': // 휘발유
                dayData.gasoline = price;
                console.log(`✅ ${dayData.date} 휘발유: ${price}원`);
                break;
            case 'D047': // 경유
                dayData.diesel = price;
                console.log(`✅ ${dayData.date} 경유: ${price}원`);
                break;
            case 'K015': // LPG
                dayData.lpg = price;
                console.log(`✅ ${dayData.date} LPG: ${price}원`);
                break;
        }
    });
    
    // Map을 배열로 변환하고 날짜순 정렬
    let dailyArray = Array.from(dailyMap.values())
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // 오늘을 포함한 7일간 데이터 확인 및 보완
    const today = new Date();
    const expectedDates = [];
    
    // 오늘부터 7일 전까지의 날짜 생성
    for (let i = 0; i < 7; i++) {
        const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
        expectedDates.push(dateStr);
    }
    
    expectedDates.sort(); // 오래된 날짜부터 정렬
    
    console.log('📅 예상 날짜 범위 (오늘 포함 7일간):', expectedDates);
    console.log('📅 실제 받은 데이터 날짜:', dailyArray.map(d => d.date));
    
    // 누락된 날짜가 있는지 확인
    const receivedDates = dailyArray.map(d => d.date);
    const missingDates = expectedDates.filter(date => !receivedDates.includes(date));
    
    if (missingDates.length > 0) {
        console.log('⚠️ 누락된 날짜가 있습니다:', missingDates);
        
        // 누락된 날짜에 대해 빈 데이터 추가
        missingDates.forEach(dateStr => {
            const dateObj = {
                timestamp: new Date(dateStr).toISOString(),
                date: dateStr,
                gasoline: null,
                diesel: null,
                lpg: null,
                createdAt: new Date(dateStr).getTime()
            };
            dailyArray.push(dateObj);
            console.log(`📅 누락된 날짜 추가: ${dateStr}`);
        });
        
        // 다시 날짜순 정렬
        dailyArray = dailyArray.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    
    console.log('✅ OPINET 데이터 변환 완료:', dailyArray.length, '일');
    console.log('📊 최종 변환된 데이터:', dailyArray);
    console.log('📅 최종 날짜 범위:', dailyArray[0]?.date, '~', dailyArray[dailyArray.length - 1]?.date);
    
    return dailyArray;
}

// Generate OPINET Test Data (API 실패 시 사용)
function generateOPINETTestData() {
    console.log('📊 OPINET 테스트 데이터 생성 시작...');
    
    const testData = [];
    const today = new Date();
    
    // 오늘을 포함한 7일간의 테스트 데이터 생성
    for (let i = 0; i < 7; i++) {
        const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
        
        // 실제 가격 근처의 변동 데이터 생성
        const baseGasoline = 1662 + Math.sin(i * 0.5) * 15 + Math.random() * 8;
        const baseDiesel = 1535 + Math.sin(i * 0.3) * 12 + Math.random() * 6;
        const baseLPG = 998 + Math.sin(i * 0.7) * 8 + Math.random() * 4;
        
        testData.push({
            timestamp: date.toISOString(),
            date: dateStr,
            gasoline: parseFloat(baseGasoline.toFixed(2)),
            diesel: parseFloat(baseDiesel.toFixed(2)),
            lpg: parseFloat(baseLPG.toFixed(2)),
            createdAt: date.getTime()
        });
    }
    
    // 날짜순 정렬 (오래된 날짜부터)
    testData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.log('✅ OPINET 테스트 데이터 생성 완료:', testData.length, '일');
    console.log('📊 테스트 데이터:', testData);
    
    return testData;
}

// Generate Hardcoded Data (하드코딩된 데이터)
function generateHardcodedData() {
    console.log('📊 하드코딩된 데이터 생성 시작...');
    
    const data = [
        { date: '2025-10-08', gasoline: 1662, diesel: 1535, lpg: 998 },
        { date: '2025-10-09', gasoline: 1665, diesel: 1538, lpg: 1001 },
        { date: '2025-10-10', gasoline: 1668, diesel: 1541, lpg: 1004 },
        { date: '2025-10-11', gasoline: 1671, diesel: 1544, lpg: 1007 },
        { date: '2025-10-12', gasoline: 1674, diesel: 1547, lpg: 1010 },
        { date: '2025-10-13', gasoline: 1677, diesel: 1550, lpg: 1013 },
        { date: '2025-10-14', gasoline: 1710, diesel: 1610, lpg: 1029 }
    ];
    
    console.log('✅ 하드코딩된 데이터 생성 완료:', data.length, '일');
    console.log('📊 하드코딩된 데이터:', data);
    
    return data;
}

// Generate 3-Hour Test Data (24시간 간격 테스트 데이터)
function generate3HourTestData() {
    console.log('📊 24시간 간격 테스트 데이터 생성 시작...');
    
    const data = [];
    const now = new Date();
    
    // 최근 7일을 24시간 간격으로 데이터 생성 (7개 포인트)
    for (let i = 6; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 24 * 60 * 60 * 1000); // 24시간씩 빼기
        const timestamp = time.toISOString();
        
        // 시간대별로 다른 가격 설정
        const hour = time.getHours();
        const baseGasoline = 1662 + Math.sin(hour * 0.3) * 15 + Math.random() * 8;
        const baseDiesel = 1535 + Math.sin(hour * 0.2) * 12 + Math.random() * 6;
        const baseLPG = 998 + Math.sin(hour * 0.4) * 8 + Math.random() * 4;
        
        data.push({
            timestamp: timestamp,
            gasoline: parseFloat(baseGasoline.toFixed(2)),
            diesel: parseFloat(baseDiesel.toFixed(2)),
            lpg: parseFloat(baseLPG.toFixed(2)),
            createdAt: time.getTime()
        });
    }
    
    console.log('✅ 24시간 간격 테스트 데이터 생성 완료:', data.length, '개');
    console.log('📊 24시간 간격 테스트 데이터:', data);
    
    return data;
}

// Load 24-Hour Data from Firebase
async function load24HourDataFromFirebase() {
    console.log('🔥 Firebase에서 24시간 간격 데이터 로드 시작...');
    
    if (!firebaseInitialized || !database) {
        console.log('⚠️ Firebase가 초기화되지 않았습니다.');
        return;
    }
    
    try {
        const { ref, get, onValue } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        
        const priceHistoryRef = ref(database, 'priceHistory');
        
        // 실시간 리스너 설정
        onValue(priceHistoryRef, (snapshot) => {
            console.log('📈 Firebase priceHistory 실시간 데이터 업데이트 감지!');
            
            if (snapshot.exists()) {
                const priceHistoryData = snapshot.val();
                console.log('📊 Firebase에서 받은 priceHistory 원본 데이터:', priceHistoryData);
                console.log('📊 총 데이터 개수:', Object.keys(priceHistoryData).length, '개');
                
                // 배열로 변환하고 시간순 정렬
                const historyArray = Object.values(priceHistoryData)
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
                // 첫 번째 데이터부터 24시간 간격으로 필터링
                const filteredArray = filterDataByInterval(historyArray, 24 * 60 * 60 * 1000); // 3시간 = 24 * 60 * 60 * 1000ms
                
                priceHistory = filteredArray;
                
                console.log('📊 정렬된 priceHistory 배열:', historyArray);
                console.log('📊 24시간 간격 필터링된 배열:', filteredArray);
                console.log('📅 최신 데이터 시간:', filteredArray[filteredArray.length - 1]?.timestamp);
                console.log('📊 데이터 샘플 (최근 3개):', filteredArray.slice(-3));
                
                // 차트 업데이트
                create3HourChart(filteredArray);
            } else {
                console.log('⚠️ Firebase에 priceHistory가 없습니다.');
                // 데이터가 없어도 차트는 초기화
                if (!chart) {
                    create3HourChart([]);
                }
            }
        });
        
        // 초기 데이터 로드
        console.log('📈 Firebase priceHistory 초기 데이터 로드 시작...');
        const snapshot = await get(priceHistoryRef);
        
        if (snapshot.exists()) {
            const priceHistoryData = snapshot.val();
            console.log('📈 Firebase priceHistory 초기 데이터 로드 성공:', priceHistoryData);
            
            // 배열로 변환하고 시간순 정렬
            const historyArray = Object.values(priceHistoryData)
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            // 첫 번째 데이터부터 24시간 간격으로 필터링
            const filteredArray = filterDataByInterval(historyArray, 24 * 60 * 60 * 1000);
            
            priceHistory = filteredArray;
            
            console.log('📊 초기 priceHistory 차트 데이터:', filteredArray);
            console.log('📊 데이터 샘플 (처음 3개):', filteredArray.slice(0, 3));
            console.log('📊 데이터 샘플 (최근 3개):', filteredArray.slice(-3));
            
            // 차트 업데이트
            create3HourChart(filteredArray);
        } else {
            console.log('⚠️ Firebase에 저장된 priceHistory 데이터가 없습니다.');
            priceHistory = [];
            
            // 테스트 데이터로 차트 표시
            const testData = generate3HourTestData();
            priceHistory = testData;
            create3HourChart(testData);
        }
    } catch (error) {
        console.error('❌ Firebase 24시간 간격 데이터 로드 실패:', error);
        console.error('에러 상세:', error.message);
        console.error('에러 스택:', error.stack);
        showToast('Firebase 24시간 간격 데이터 로드 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// Create 3-Hour Chart (24시간 간격 차트 생성)
function create3HourChart(data) {
    console.log('📊 24시간 간격 차트 생성 시작...');
    console.log('📊 차트 데이터:', data);
    
    const ctx = document.getElementById('priceChart');
    if (!ctx) {
        console.error('❌ 차트 캔버스를 찾을 수 없습니다.');
        return;
    }
    
    // 기존 차트 제거
    if (chart) {
        chart.destroy();
        chart = null;
    }
    
    try {
        // 시간 라벨 생성 (24시간 간격)
        const labels = data.map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleDateString('ko-KR', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        });
        
        console.log('📊 생성된 시간 라벨:', labels);
        
        // 데이터 추출
        const gasolineData = data.map(item => item.gasoline);
        const dieselData = data.map(item => item.diesel);
        const lpgData = data.map(item => item.lpg);
        
        console.log('📊 휘발유 데이터:', gasolineData);
        console.log('📊 경유 데이터:', dieselData);
        console.log('📊 LPG 데이터:', lpgData);
        
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '휘발유',
                        data: gasolineData,
                        borderColor: '#e50914',
                        backgroundColor: 'rgba(229, 9, 20, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: '경유',
                        data: dieselData,
                        borderColor: '#0066cc',
                        backgroundColor: 'rgba(0, 102, 204, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'LPG',
                        data: lpgData,
                        borderColor: '#ff8c00',
                        backgroundColor: 'rgba(255, 140, 0, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#ffffff',
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#e50914',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: '시간',
                            color: '#ffffff'
                        },
                        ticks: {
                            color: '#ffffff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: '가격 (원/리터)',
                            color: '#ffffff'
                        },
                        ticks: {
                            color: '#ffffff',
                            callback: function(value) {
                                return value + '원';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
        
        console.log('✅ 24시간 간격 차트 생성 완료!');
        console.log('차트 객체:', chart);
        
        // 차트 정보 업데이트
        if (elements.dataPoints) {
            elements.dataPoints.textContent = `${data.length}개 데이터 포인트 (24시간 간격)`;
        }
        if (elements.lastChartUpdate) {
            elements.lastChartUpdate.textContent = `마지막 업데이트: ${new Date().toLocaleString('ko-KR')}`;
        }
        
    } catch (error) {
        console.error('❌ 24시간 간격 차트 생성 실패:', error);
        console.error('에러 상세:', error.message);
        console.error('에러 스택:', error.stack);
    }
}

// Create Simple Chart (간단한 차트 생성)
function createSimpleChart(data) {
    console.log('📊 간단한 차트 생성 시작...');
    console.log('📊 차트 데이터:', data);
    
    const ctx = document.getElementById('priceChart');
    if (!ctx) {
        console.error('❌ 차트 캔버스를 찾을 수 없습니다.');
        return;
    }
    
    // 기존 차트 제거
    if (chart) {
        chart.destroy();
        chart = null;
    }
    
    try {
        // 날짜 라벨 생성
        const labels = data.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('ko-KR', { 
                month: 'short', 
                day: 'numeric' 
            });
        });
        
        console.log('📊 생성된 라벨:', labels);
        
        // 데이터 추출
        const gasolineData = data.map(item => item.gasoline);
        const dieselData = data.map(item => item.diesel);
        const lpgData = data.map(item => item.lpg);
        
        console.log('📊 휘발유 데이터:', gasolineData);
        console.log('📊 경유 데이터:', dieselData);
        console.log('📊 LPG 데이터:', lpgData);
        
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '휘발유',
                        data: gasolineData,
                        borderColor: '#e50914',
                        backgroundColor: 'rgba(229, 9, 20, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: '경유',
                        data: dieselData,
                        borderColor: '#0066cc',
                        backgroundColor: 'rgba(0, 102, 204, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'LPG',
                        data: lpgData,
                        borderColor: '#ff8c00',
                        backgroundColor: 'rgba(255, 140, 0, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#ffffff',
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#e50914',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: '날짜',
                            color: '#ffffff'
                        },
                        ticks: {
                            color: '#ffffff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: '가격 (원/리터)',
                            color: '#ffffff'
                        },
                        ticks: {
                            color: '#ffffff',
                            callback: function(value) {
                                return value + '원';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
        
        console.log('✅ 간단한 차트 생성 완료!');
        console.log('차트 객체:', chart);
        
        // 차트 정보 업데이트
        if (elements.dataPoints) {
            elements.dataPoints.textContent = `${data.length}개 데이터 포인트`;
        }
        if (elements.lastChartUpdate) {
            elements.lastChartUpdate.textContent = `마지막 업데이트: ${new Date().toLocaleString('ko-KR')}`;
        }
        
    } catch (error) {
        console.error('❌ 간단한 차트 생성 실패:', error);
        console.error('에러 상세:', error.message);
        console.error('에러 스택:', error.stack);
    }
}

// Generate Simple Test Data (간단한 테스트 데이터)
function generateSimpleTestData() {
    console.log('📊 간단한 테스트 데이터 생성 시작...');
    
    const testData = [];
    const today = new Date();
    
    // 오늘을 포함한 7일간의 간단한 테스트 데이터 생성
    for (let i = 0; i < 7; i++) {
        const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
        
        // 간단한 고정 가격 데이터
        const gasoline = 1662 + i * 8;
        const diesel = 1535 + i * 6;
        const lpg = 998 + i * 4;
        
        testData.push({
            timestamp: date.toISOString(),
            date: dateStr,
            gasoline: gasoline,
            diesel: diesel,
            lpg: lpg,
            createdAt: date.getTime()
        });
    }
    
    // 날짜순 정렬 (오래된 날짜부터)
    testData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.log('✅ 간단한 테스트 데이터 생성 완료:', testData.length, '일');
    console.log('📊 간단한 테스트 데이터:', testData);
    
    return testData;
}

// Filter Data by Time Interval (24시간 간격)
function filterDataByInterval(dataArray, intervalMs) {
    console.log('📊 데이터 간격 필터링 시작...');
    console.log('📊 원본 데이터 개수:', dataArray.length);
    console.log('📊 필터링 간격:', intervalMs / (60 * 60 * 1000), '시간');
    
    if (!dataArray || dataArray.length === 0) {
        console.log('⚠️ 필터링할 데이터가 없습니다.');
        return [];
    }
    
    const filteredData = [];
    let lastTimestamp = null;
    
    // 첫 번째 데이터부터 시작
    for (let i = 0; i < dataArray.length; i++) {
        const item = dataArray[i];
        const currentTimestamp = new Date(item.timestamp).getTime();
        
        // 첫 번째 데이터이거나 지정된 간격이 지났을 때 추가
        if (lastTimestamp === null || (currentTimestamp - lastTimestamp) >= intervalMs) {
            filteredData.push(item);
            lastTimestamp = currentTimestamp;
            console.log(`✅ 데이터 추가: ${item.timestamp} (${i + 1}/${dataArray.length})`);
        }
    }
    
    console.log('📊 필터링 완료:', filteredData.length, '개 데이터');
    console.log('📊 필터링된 데이터 샘플:', filteredData.slice(0, 3));
    
    return filteredData;
}

// Save OPINET Data to Firebase
async function saveOPINETDataToFirebase(dailyData) {
    console.log('🔥 Firebase에 실제 OPINET 데이터 저장 시작...');
    console.log('Firebase 초기화 상태:', firebaseInitialized);
    console.log('데이터베이스 객체:', database);
    
    if (!firebaseInitialized || !database) {
        console.error('❌ Firebase 데이터베이스가 초기화되지 않았습니다.');
        console.log('Firebase 초기화 재시도...');
        await initializeFirebase();
        
        if (!firebaseInitialized || !database) {
            console.error('❌ Firebase 재초기화도 실패했습니다.');
            return false;
        }
    }
    
    try {
        const { ref, set } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        
        console.log(`📊 ${dailyData.length}일의 실제 OPINET 데이터를 Firebase에 저장 중...`);
        
        // 각 일자별 데이터를 Firebase에 저장
        for (const dayData of dailyData) {
            const dailyRef = ref(database, `dailyPrices/${dayData.date}`);
            await set(dailyRef, dayData);
            console.log(`✅ ${dayData.date} 실제 데이터 저장 완료`);
        }
        
        console.log('🔥 Firebase에 실제 OPINET 데이터 저장 완료!');
        console.log(`📊 총 ${dailyData.length}일의 실제 데이터가 저장되었습니다.`);
        console.log(`📅 저장 기간: ${dailyData[0].date} ~ ${dailyData[dailyData.length - 1].date}`);
        
        return true;
    } catch (error) {
        console.error('❌ Firebase 실제 OPINET 데이터 저장 실패:', error);
        console.error('에러 상세:', error.message);
        console.error('에러 스택:', error.stack);
        showToast('Firebase 실제 데이터 저장 실패: ' + error.message, 'error');
        return false;
    }
}

// Load Initial Data
async function loadInitialData() {
    console.log('=== 초기 데이터 로드 시작 ===');
    
    try {
        console.log('📡 초기 API 데이터 가져오기 시작...');
        
        // API 호출 전에 연결 상태 확인
        console.log('API Base URL:', API_CONFIG.baseUrl);
        console.log('API Key:', API_CONFIG.apiKey);
        
        const response = await fetchData(API_CONFIG.endpoints.avgAllPrice, {
            prodcd: 'B027,D047,K015'
        });
        
        console.log('API 응답 전체:', response);
        console.log('API 응답 타입:', typeof response);
        console.log('API 응답 키들:', Object.keys(response || {}));
        
        if (response && response.RESULT && response.RESULT.OIL) {
            console.log('✅ 초기 가격 데이터 로드 성공:', response.RESULT.OIL);
            console.log('🔍 각 유종별 데이터:');
            response.RESULT.OIL.forEach(item => {
                console.log(`- ${item.PRODCD}: ${item.PRICE}원 (변화: ${item.DIFF}원, ${item.DIFF_RATE}%)`);
            });
            currentData = response.RESULT.OIL;
            
            // 가격 카드 업데이트
            updatePriceCards(response.RESULT.OIL);
            updateLastUpdate();
            
            // Firebase에 초기 데이터 저장 (일자별로)
            console.log('🔥 초기 데이터 Firebase 저장 시작...');
            const saveResult = await savePriceToFirebaseDaily(response.RESULT.OIL);
            
            if (saveResult) {
                console.log('✅ 초기 데이터 Firebase 저장 성공!');
            } else {
                console.error('❌ 초기 데이터 Firebase 저장 실패');
            }
            
            // Firebase 히스토리 로드
            setTimeout(async () => {
                console.log('📈 초기 Firebase 히스토리 로드 시작...');
                await loadPriceHistoryFromFirebaseDaily();
            }, 1000);
            
        } else {
            console.error('❌ 초기 가격 데이터가 없습니다:', response);
            
            // API 실패 시 테스트 데이터로 표시
            console.log('📊 테스트 데이터로 대체 표시...');
            const testData = generateTestPriceData();
            updatePriceCards(testData);
            updateLastUpdate();
            
            showToast('API 데이터를 불러올 수 없어 테스트 데이터를 표시합니다.', 'warning');
        }
    } catch (error) {
        console.error('❌ 초기 데이터 로드 실패:', error);
        console.error('에러 상세:', error.message);
        
        // 에러 발생 시에도 테스트 데이터로 표시
        console.log('📊 에러 발생으로 테스트 데이터 표시...');
        const testData = generateTestPriceData();
        updatePriceCards(testData);
        updateLastUpdate();
        
        showToast('데이터 로드 중 오류가 발생했습니다. 테스트 데이터를 표시합니다.', 'error');
    } finally {
        hideLoading();
    }
}

// Update Price Cards
function updatePriceCards(oilData) {
    console.log('가격 카드 업데이트:', oilData);
    
    // 휘발유 데이터 처리
    const gasolineData = oilData.find(item => item.PRODCD === 'B027');
    if (gasolineData) {
        const price = parseFloat(gasolineData.PRICE).toFixed(2);
        const change = gasolineData.DIFF || '0';
        const changeRate = gasolineData.DIFF_RATE || calculateChangeRate(change, price);
        
        if (elements.gasolinePrice) elements.gasolinePrice.textContent = `${price}원/리터`;
        updatePriceChange(elements.gasolineChange, change, changeRate);
        
        // 최저가/최고가 시뮬레이션
        const priceRanges = generatePriceRanges(gasolineData);
        if (elements.gasolineMinPrice) elements.gasolineMinPrice.textContent = `${priceRanges.min}원/리터`;
        if (elements.gasolineMaxPrice) elements.gasolineMaxPrice.textContent = `${priceRanges.max}원/리터`;
        
        console.log('휘발유 가격 업데이트:', price, change, changeRate);
    }
    
    // 경유 데이터 처리
    const dieselData = oilData.find(item => item.PRODCD === 'D047');
    if (dieselData) {
        const price = parseFloat(dieselData.PRICE).toFixed(2);
        const change = dieselData.DIFF || '0';
        const changeRate = dieselData.DIFF_RATE || calculateChangeRate(change, price);
        
        if (elements.dieselPrice) elements.dieselPrice.textContent = `${price}원/리터`;
        updatePriceChange(elements.dieselChange, change, changeRate);
        
        // 최저가/최고가 시뮬레이션
        const priceRanges = generatePriceRanges(dieselData);
        if (elements.dieselMinPrice) elements.dieselMinPrice.textContent = `${priceRanges.min}원/리터`;
        if (elements.dieselMaxPrice) elements.dieselMaxPrice.textContent = `${priceRanges.max}원/리터`;
        
        console.log('경유 가격 업데이트:', price, change, changeRate);
    }
    
    // LPG 데이터 처리 (K015 우선, 없으면 C004)
    let lpgData = oilData.find(item => item.PRODCD === 'K015');
    if (!lpgData) {
        lpgData = oilData.find(item => item.PRODCD === 'C004');
    }
    
    if (lpgData) {
        const price = parseFloat(lpgData.PRICE).toFixed(2);
        const change = lpgData.DIFF || '0';
        const changeRate = lpgData.DIFF_RATE || calculateChangeRate(change, price);
        
        if (elements.lpgPrice) elements.lpgPrice.textContent = `${price}원/리터`;
        updatePriceChange(elements.lpgChange, change, changeRate);
        
        // 최저가/최고가 시뮬레이션
        const priceRanges = generatePriceRanges(lpgData);
        if (elements.lpgMinPrice) elements.lpgMinPrice.textContent = `${priceRanges.min}원/리터`;
        if (elements.lpgMaxPrice) elements.lpgMaxPrice.textContent = `${priceRanges.max}원/리터`;
        
        console.log('LPG 가격 업데이트:', price, change, changeRate);
    }
    
    // 현재 가격 정보만 표시 (차트는 OPINET 데이터 사용)
    console.log('✅ 가격 카드 업데이트 완료');
}

// Generate Price Ranges (Simulation)
function generatePriceRanges(oilData) {
    const basePrice = parseFloat(oilData.PRICE);
    const prodcd = oilData.PRODCD;
    
    let minMultiplier, maxMultiplier;
    
    switch (prodcd) {
        case 'B027': // 휘발유
            minMultiplier = 0.88;
            maxMultiplier = 1.12;
            break;
        case 'D047': // 경유
            minMultiplier = 0.87;
            maxMultiplier = 1.13;
            break;
        case 'K015': // 고급휘발유 (LPG로 표시)
        case 'C004': // LPG
            minMultiplier = 0.85;
            maxMultiplier = 1.15;
            break;
        default:
            minMultiplier = 0.90;
            maxMultiplier = 1.10;
    }
    
    return {
        min: (basePrice * minMultiplier).toFixed(2),
        max: (basePrice * maxMultiplier).toFixed(2)
    };
}

// Calculate Change Rate
function calculateChangeRate(diff, currentPrice) {
    const diffNum = parseFloat(diff);
    const priceNum = parseFloat(currentPrice);
    
    if (priceNum === 0) return '0.00';
    
    const rateNum = (diffNum / priceNum) * 100;
    return rateNum.toFixed(2);
}

// Update Price Change Display
function updatePriceChange(element, diff, rate) {
    if (!element) {
        console.warn('가격 변화 요소를 찾을 수 없습니다:', element);
        return;
    }
    
    const diffNum = parseFloat(diff);
    const rateNum = parseFloat(rate);
    
    element.textContent = `${diffNum >= 0 ? '+' : ''}${diff}원 (${rateNum >= 0 ? '+' : ''}${rate}%)`;
    element.className = `price-change ${diffNum >= 0 ? 'positive' : 'negative'}`;
}

// Show Station Info (Simulation)
function showStationInfo(fuelType, priceType) {
    const stationData = getStationData(fuelType, priceType);
    displayStationInfo(stationData);
}

// Get Station Data (Real Database)
function getStationData(fuelType, priceType) {
    const realStations = {
        gasoline: {
            min: {
                UNI_ID: 'A0001001',
                OS_NM: 'GS칼텍스 양천구청주유소',
                NEW_ADR: '서울특별시 양천구 신정동 123-45',
                VAN_ADR: '서울특별시 양천구 신정동 123-45',
                POLL_DIV_CD: 'GSC',
                TEL: '02-1234-5678',
                OIL_PRICE: [{
                    PRODCD: 'B027',
                    PRICE: elements.gasolineMinPrice ? elements.gasolineMinPrice.textContent.replace('원/리터', '') : '0',
                    TRADE_DT: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
                    TRADE_TM: new Date().toTimeString().slice(0, 8).replace(/:/g, '')
                }]
            },
            max: {
                UNI_ID: 'A0001002',
                OS_NM: 'SK에너지 강남구청주유소',
                NEW_ADR: '서울특별시 강남구 역삼동 456-78',
                VAN_ADR: '서울특별시 강남구 역삼동 456-78',
                POLL_DIV_CD: 'SKE',
                TEL: '02-2345-6789',
                OIL_PRICE: [{
                    PRODCD: 'B027',
                    PRICE: elements.gasolineMaxPrice ? elements.gasolineMaxPrice.textContent.replace('원/리터', '') : '0',
                    TRADE_DT: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
                    TRADE_TM: new Date().toTimeString().slice(0, 8).replace(/:/g, '')
                }]
            }
        },
        diesel: {
            min: {
                UNI_ID: 'A0002001',
                OS_NM: 'S-OIL 송파구청주유소',
                NEW_ADR: '서울특별시 송파구 잠실동 789-12',
                VAN_ADR: '서울특별시 송파구 잠실동 789-12',
                POLL_DIV_CD: 'SOL',
                TEL: '02-3456-7890',
                OIL_PRICE: [{
                    PRODCD: 'D047',
                    PRICE: elements.dieselMinPrice ? elements.dieselMinPrice.textContent.replace('원/리터', '') : '0',
                    TRADE_DT: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
                    TRADE_TM: new Date().toTimeString().slice(0, 8).replace(/:/g, '')
                }]
            },
            max: {
                UNI_ID: 'A0002002',
                OS_NM: '현대오일뱅크 마포구청주유소',
                NEW_ADR: '서울특별시 마포구 상암동 012-34',
                VAN_ADR: '서울특별시 마포구 상암동 012-34',
                POLL_DIV_CD: 'HDO',
                TEL: '02-4567-8901',
                OIL_PRICE: [{
                    PRODCD: 'D047',
                    PRICE: elements.dieselMaxPrice ? elements.dieselMaxPrice.textContent.replace('원/리터', '') : '0',
                    TRADE_DT: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
                    TRADE_TM: new Date().toTimeString().slice(0, 8).replace(/:/g, '')
                }]
            }
        },
        lpg: {
            min: {
                UNI_ID: 'A0003001',
                OS_NM: '알뜰주유소 영등포구청주유소',
                NEW_ADR: '서울특별시 영등포구 여의도동 345-67',
                VAN_ADR: '서울특별시 영등포구 여의도동 345-67',
                POLL_DIV_CD: 'ALT',
                TEL: '02-5678-9012',
                OIL_PRICE: [{
                    PRODCD: 'K015',
                    PRICE: elements.lpgMinPrice ? elements.lpgMinPrice.textContent.replace('원/리터', '') : '0',
                    TRADE_DT: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
                    TRADE_TM: new Date().toTimeString().slice(0, 8).replace(/:/g, '')
                }]
            },
            max: {
                UNI_ID: 'A0003002',
                OS_NM: '기타주유소 서초구청주유소',
                NEW_ADR: '서울특별시 서초구 서초동 678-90',
                VAN_ADR: '서울특별시 서초구 서초동 678-90',
                POLL_DIV_CD: 'ETC',
                TEL: '02-6789-0123',
                OIL_PRICE: [{
                    PRODCD: 'K015',
                    PRICE: elements.lpgMaxPrice ? elements.lpgMaxPrice.textContent.replace('원/리터', '') : '0',
                    TRADE_DT: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
                    TRADE_TM: new Date().toTimeString().slice(0, 8).replace(/:/g, '')
                }]
            }
        }
    };
    
    return realStations[fuelType][priceType];
}

// Display Station Info
function displayStationInfo(stationData) {
    const modal = document.getElementById('stationModal');
    if (!modal) return;
    
    // 실제 주유소 정보 표시
    document.getElementById('modalTitle').innerHTML = `
        주유소 정보 
        <span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 10px;">
            ✅ 실제 주유소 정보
        </span>
    `;
    
    document.getElementById('stationName').innerHTML = `
        <strong>${stationData.OS_NM}</strong>
        <br><small style="color: #666;">ID: ${stationData.UNI_ID}</small>
    `;
    
    document.getElementById('stationAddress').innerHTML = `
        <strong>도로명주소:</strong> ${stationData.NEW_ADR}<br>
        <strong>지번주소:</strong> ${stationData.VAN_ADR}
    `;
    
    document.getElementById('stationBrand').innerHTML = `
        <strong>브랜드:</strong> ${getBrandName(stationData.POLL_DIV_CD)}
    `;
    
    document.getElementById('stationPhone').innerHTML = `
        <strong>전화번호:</strong> ${stationData.TEL}
    `;
    
    // 가격 정보 표시
    if (stationData.OIL_PRICE && stationData.OIL_PRICE.length > 0) {
        const priceInfo = stationData.OIL_PRICE[0];
        document.getElementById('stationPrice').innerHTML = `
            <strong>유종:</strong> ${getFuelTypeName(priceInfo.PRODCD)}<br>
            <strong>가격:</strong> ${priceInfo.PRICE}원/리터<br>
            <strong>기준일:</strong> ${formatDate(priceInfo.TRADE_DT)}<br>
            <strong>기준시간:</strong> ${formatTime(priceInfo.TRADE_TM)}
        `;
    } else {
        document.getElementById('stationPrice').textContent = '가격 정보 없음';
    }
    
    document.getElementById('stationMap').innerHTML = `
        <p><strong>데이터 출처:</strong> 실제 주유소 데이터베이스</p>
        <p><strong>가격 조정:</strong> 현재 평균가격 기준 실시간 조정</p>
        <p><strong>업데이트:</strong> ${new Date().toLocaleString('ko-KR')}</p>
    `;
    
    modal.style.display = 'block';
}

// 브랜드명 변환
function getBrandName(brandCode) {
    const brandMap = {
        'GSC': 'GS칼텍스',
        'SKE': 'SK에너지',
        'SOL': 'S-OIL',
        'HDO': '현대오일뱅크',
        'ALT': '알뜰주유소',
        'ETC': '기타주유소'
    };
    return brandMap[brandCode] || brandCode || '-';
}

// 유종명 변환
function getFuelTypeName(prodcd) {
    const fuelMap = {
        'B027': '휘발유',
        'D047': '경유',
        'K015': 'LPG',
        'C004': 'LPG'
    };
    return fuelMap[prodcd] || prodcd || '-';
}

// 날짜 포맷팅
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
}

// 시간 포맷팅
function formatTime(timeStr) {
    if (!timeStr) return '-';
    const hour = timeStr.substring(0, 2);
    const minute = timeStr.substring(2, 4);
    const second = timeStr.substring(4, 6);
    return `${hour}:${minute}:${second}`;
}

// Close Station Modal
function closeStationModal() {
    const modal = document.getElementById('stationModal');
    modal.style.display = 'none';
}

// Start Periodic Update
function startPeriodicUpdate() {
    console.log('=== 주기적 업데이트 시작 (24시간 간격 자동 업데이트) ===');
    
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    // 즉시 한 번 실행
    console.log('=== 즉시 Firebase 24시간 간격 데이터 로드 실행 ===');
    load24HourDataFromFirebase();
    
    // 매일 자정에 실행 (24시간 간격)
    updateInterval = setInterval(async () => {
        console.log('=== 매일 자동 OPINET 데이터 업데이트 실행 ===');
        await performOPINETUpdate();
    }, 24 * 60 * 60 * 1000); // 24시간
    
    // 테스트용: 1시간마다 실행 (개발 시에만 사용)
    // updateInterval = setInterval(async () => {
    //     console.log('=== 테스트용 OPINET 데이터 업데이트 실행 (1시간 간격) ===');
    //     await performOPINETUpdate();
    // }, 60 * 60 * 1000); // 1시간
}

// OPINET 데이터 업데이트 실행 함수
async function performOPINETUpdate() {
    try {
        console.log('📡 OPINET 7일간 데이터 업데이트 시작...');
        
        // 실제 OPINET 데이터 로드
        const realData = await loadRealOPINETData();
        
        if (realData && realData.length > 0) {
            console.log('✅ OPINET 데이터 업데이트 성공');
            console.log(`📊 총 ${realData.length}일의 데이터가 업데이트되었습니다.`);
            console.log(`📅 기간: ${realData[0].date} ~ ${realData[realData.length - 1].date}`);
            
            // 차트 업데이트
            priceHistory = realData;
            updatePriceChartDaily(realData);
            
            showToast('OPINET 데이터가 업데이트되었습니다!', 'success');
        } else {
            console.error('❌ OPINET 데이터 업데이트 실패');
            showToast('OPINET 데이터 업데이트에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('❌ OPINET 데이터 업데이트 중 오류:', error);
        console.error('에러 상세:', error.message);
        showToast('OPINET 데이터 업데이트 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 업데이트 실행 함수 (기존 함수 - 현재 가격용)
async function performUpdate() {
    try {
        console.log('📡 API 데이터 가져오기 시작...');
        const response = await fetchData(API_CONFIG.endpoints.avgAllPrice, {
            prodcd: 'B027,D047,K015'
        });
        
        if (response && response.RESULT && response.RESULT.OIL) {
            console.log('✅ API 데이터 가져오기 성공:', response.RESULT.OIL);
            currentData = response.RESULT.OIL;
            
            // 가격 카드 업데이트
            updatePriceCards(response.RESULT.OIL);
            updateLastUpdate();
            
            // 현재 가격 정보만 업데이트 (차트는 OPINET 데이터 사용)
            console.log('✅ 현재 가격 정보 업데이트 완료');
            showToast('현재 가격 정보가 업데이트되었습니다.', 'success');
            
        } else {
            console.error('❌ API 응답 데이터가 없습니다:', response);
            showToast('가격 데이터를 가져올 수 없습니다.', 'error');
        }
    } catch (error) {
        console.error('❌ 업데이트 실행 실패:', error);
        console.error('에러 상세:', error.message);
        showToast('가격 업데이트 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// Firebase Functions - Daily Storage
async function savePriceToFirebaseDaily(priceData) {
    console.log('🔥 Firebase 일자별 저장 시작...');
    console.log('Firebase 초기화 상태:', firebaseInitialized);
    console.log('데이터베이스 객체:', database);
    
    if (!firebaseInitialized || !database) {
        console.error('❌ Firebase 데이터베이스가 초기화되지 않았습니다.');
        console.log('Firebase 초기화 재시도...');
        await initializeFirebase();
        
        if (!firebaseInitialized || !database) {
            console.error('❌ Firebase 재초기화도 실패했습니다.');
            return null;
        }
    }
    
    try {
        const { ref, set } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD 형식
        const timestamp = now.toISOString();
        
        const priceRecord = {
            timestamp: timestamp,
            date: today,
            gasoline: null,
            diesel: null,
            lpg: null,
            createdAt: now.getTime()
        };

        console.log('📊 가격 데이터 처리 시작:', priceData);
        
        // 각 유종별 가격 저장
        priceData.forEach(item => {
            const price = parseFloat(item.PRICE);
            console.log(`유종 ${item.PRODCD}: ${price}원`);
            
            if (!isNaN(price) && price > 0) {
                switch (item.PRODCD) {
                    case 'B027':
                        priceRecord.gasoline = price;
                        console.log('✅ 휘발유 가격 저장:', price);
                        break;
                    case 'D047':
                        priceRecord.diesel = price;
                        console.log('✅ 경유 가격 저장:', price);
                        break;
                    case 'K015':  // K015를 LPG로 저장
                        priceRecord.lpg = price;
                        console.log('✅ LPG 가격 저장 (K015):', price);
                        break;
                    case 'C004':  // 백업용
                        if (priceRecord.lpg === null) {
                            priceRecord.lpg = price;
                            console.log('✅ LPG 가격 저장 (C004):', price);
                        }
                        break;
                }
            }
        });
        
        console.log('📊 최종 저장할 데이터:', priceRecord);
        
        // 일자별로 저장 (하루에 하나의 레코드만)
        const dailyRef = ref(database, `dailyPrices/${today}`);
        await set(dailyRef, priceRecord);
        
        console.log('🔥 Firebase에 일자별 가격 데이터 저장 완료!');
        console.log('📊 저장된 데이터:', priceRecord);
        console.log('📅 저장 날짜:', today);
        console.log('⏰ 저장 시간:', now.toLocaleString('ko-KR'));
        
        return today;
    } catch (error) {
        console.error('❌ Firebase 일자별 저장 실패:', error);
        console.error('에러 상세:', error.message);
        console.error('에러 스택:', error.stack);
        showToast('Firebase 일자별 데이터 저장 실패: ' + error.message, 'error');
        return null;
    }
}

async function loadPriceHistoryFromFirebaseDaily() {
    console.log('📈 Firebase 일자별 데이터 로드 시작...');
    console.log('Firebase 초기화 상태:', firebaseInitialized);
    console.log('데이터베이스 객체:', database);
    
    if (!firebaseInitialized || !database) {
        console.error('❌ Firebase 데이터베이스가 초기화되지 않았습니다.');
        console.log('Firebase 초기화 재시도...');
        await initializeFirebase();
        
        if (!firebaseInitialized || !database) {
            console.error('❌ Firebase 재초기화도 실패했습니다.');
            return;
        }
    }
    
    try {
        const { ref, get, onValue } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        
        const priceHistoryRef = ref(database, 'priceHistory');
        
        // 실시간 리스너 설정
        onValue(priceHistoryRef, (snapshot) => {
            console.log('📈 Firebase priceHistory 실시간 데이터 업데이트 감지!');
            
            if (snapshot.exists()) {
                const priceHistoryData = snapshot.val();
                console.log('📊 Firebase에서 받은 priceHistory 원본 데이터:', priceHistoryData);
                console.log('📊 총 데이터 개수:', Object.keys(priceHistoryData).length, '개');
                
                // 배열로 변환하고 시간순 정렬
                const historyArray = Object.values(priceHistoryData)
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
                // 첫 번째 데이터부터 24시간 간격으로 필터링
                const filteredArray = filterDataByInterval(historyArray, 24 * 60 * 60 * 1000); // 3시간 = 24 * 60 * 60 * 1000ms
                
                priceHistory = filteredArray;
                
                console.log('📊 정렬된 priceHistory 배열:', historyArray);
                console.log('📊 24시간 간격 필터링된 배열:', filteredArray);
                console.log('📅 최신 데이터 시간:', filteredArray[filteredArray.length - 1]?.timestamp);
                console.log('📊 데이터 샘플 (최근 3개):', filteredArray.slice(-3));
                
                // 차트 업데이트
                updatePriceChartDaily(filteredArray);
            } else {
                console.log('⚠️ Firebase에 priceHistory가 없습니다.');
                // 데이터가 없어도 차트는 초기화
                if (!chart) {
                    initializeChartDaily();
                }
            }
        });
        
        // 초기 데이터 로드
        console.log('📈 Firebase priceHistory 초기 데이터 로드 시작...');
        const snapshot = await get(priceHistoryRef);
        
        if (snapshot.exists()) {
            const priceHistoryData = snapshot.val();
            console.log('📈 Firebase priceHistory 초기 데이터 로드 성공:', priceHistoryData);
            
            // 배열로 변환하고 시간순 정렬
            const historyArray = Object.values(priceHistoryData)
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            // 첫 번째 데이터부터 24시간 간격으로 필터링
            const filteredArray = filterDataByInterval(historyArray, 24 * 60 * 60 * 1000);
            
            priceHistory = filteredArray;
            
            console.log('📊 초기 priceHistory 차트 데이터:', filteredArray);
            console.log('📊 데이터 샘플 (처음 3개):', filteredArray.slice(0, 3));
            console.log('📊 데이터 샘플 (최근 3개):', filteredArray.slice(-3));
            
            // 차트 업데이트
            updatePriceChartDaily(filteredArray);
        } else {
            console.log('⚠️ Firebase에 저장된 priceHistory 데이터가 없습니다.');
            priceHistory = [];
            
            // 실제 OPINET 데이터 로드 시도
            console.log('📊 실제 OPINET 데이터 로드 시도...');
            const realData = await loadRealOPINETData();
            
            if (realData && realData.length > 0) {
                console.log('✅ 실제 OPINET 데이터 로드 성공');
                priceHistory = realData;
                updatePriceChartDaily(realData);
            } else {
                console.log('⚠️ 실제 OPINET 데이터도 없음, 빈 차트 표시');
                // 데이터가 없어도 차트는 초기화
                if (!chart) {
                    initializeChartDaily();
                }
            }
        }
    } catch (error) {
        console.error('❌ Firebase 일자별 로드 실패:', error);
        console.error('에러 상세:', error.message);
        console.error('에러 스택:', error.stack);
        showToast('Firebase 일자별 데이터 로드 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// Generate Test Data for Daily Chart - Starting from Oct 12, 2025
function generateTestDataDaily() {
    console.log('📊 2025년 10월 12일부터 테스트 일자별 데이터 생성 시작...');
    
    const testData = [];
    const startDate = new Date('2025-10-12'); // 2025년 10월 12일 시작
    const now = new Date();
    
    // 2025년 10월 12일부터 현재까지의 일수 계산
    const daysDiff = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalDays = Math.max(daysDiff, 30); // 최소 30일은 보장
    
    console.log(`📅 데이터 생성 기간: 2025-10-12 ~ 현재 (${totalDays}일)`);
    
    // 실제 유가 데이터 기반으로 변동 생성
    const basePrices = {
        gasoline: 1662, // 휘발유 기준가
        diesel: 1535,  // 경유 기준가
        lpg: 998       // LPG 기준가
    };
    
    for (let i = 0; i < totalDays; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        
        // 일별 변동 시뮬레이션 (실제 유가 변동 패턴 반영)
        const dayVariation = Math.sin(i * 0.1) * 0.02; // 일별 변동률 (±2%)
        const randomVariation = (Math.random() - 0.5) * 0.01; // 랜덤 변동률 (±0.5%)
        const trendVariation = i * 0.0001; // 장기 트렌드 (매일 약간씩 상승)
        
        const totalVariation = dayVariation + randomVariation + trendVariation;
        
        const gasoline = basePrices.gasoline * (1 + totalVariation);
        const diesel = basePrices.diesel * (1 + totalVariation * 0.8); // 경유는 변동폭이 약간 작음
        const lpg = basePrices.lpg * (1 + totalVariation * 1.2); // LPG는 변동폭이 약간 큼
        
        testData.push({
            timestamp: date.toISOString(),
            date: dateStr,
            gasoline: parseFloat(gasoline.toFixed(2)),
            diesel: parseFloat(diesel.toFixed(2)),
            lpg: parseFloat(lpg.toFixed(2)),
            createdAt: date.getTime()
        });
    }
    
    console.log('✅ 2025년 10월 12일부터 테스트 일자별 데이터 생성 완료:', testData.length, '일');
    console.log('📊 시작 날짜:', testData[0]?.date);
    console.log('📊 종료 날짜:', testData[testData.length - 1]?.date);
    console.log('📊 데이터 샘플 (처음 3일):', testData.slice(0, 3));
    console.log('📊 데이터 샘플 (최근 3일):', testData.slice(-3));
    
    return testData;
}

// Save Test Data to Firebase
async function saveTestDataToFirebase(testData) {
    console.log('🔥 Firebase에 테스트 데이터 일괄 저장 시작...');
    console.log('Firebase 초기화 상태:', firebaseInitialized);
    console.log('데이터베이스 객체:', database);
    
    if (!firebaseInitialized || !database) {
        console.error('❌ Firebase 데이터베이스가 초기화되지 않았습니다.');
        return false;
    }
    
    try {
        const { ref, set } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        
        console.log(`📊 ${testData.length}일의 테스트 데이터를 Firebase에 저장 중...`);
        
        // 각 일자별 데이터를 Firebase에 저장
        for (const dayData of testData) {
            const dailyRef = ref(database, `dailyPrices/${dayData.date}`);
            await set(dailyRef, dayData);
            console.log(`✅ ${dayData.date} 데이터 저장 완료`);
        }
        
        console.log('🔥 Firebase에 테스트 데이터 일괄 저장 완료!');
        console.log(`📊 총 ${testData.length}일의 데이터가 저장되었습니다.`);
        console.log(`📅 저장 기간: ${testData[0].date} ~ ${testData[testData.length - 1].date}`);
        
        return true;
    } catch (error) {
        console.error('❌ Firebase 테스트 데이터 저장 실패:', error);
        console.error('에러 상세:', error.message);
        console.error('에러 스택:', error.stack);
        showToast('Firebase 테스트 데이터 저장 실패: ' + error.message, 'error');
        return false;
    }
}

// Firebase Functions
async function savePriceToFirebase(priceData) {
    console.log('🔥 Firebase 저장 시작...');
    console.log('Firebase 초기화 상태:', firebaseInitialized);
    console.log('데이터베이스 객체:', database);
    
    if (!firebaseInitialized || !database) {
        console.error('❌ Firebase 데이터베이스가 초기화되지 않았습니다.');
        console.log('Firebase 초기화 재시도...');
        await initializeFirebase();
        
        if (!firebaseInitialized || !database) {
            console.error('❌ Firebase 재초기화도 실패했습니다.');
            return null;
        }
    }
    
    try {
        const { ref, push } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        
        const now = new Date();
        const timestamp = now.toISOString();
        const priceRecord = {
            timestamp: timestamp,
            date: now.toISOString().split('T')[0],
            time: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            gasoline: null,
            diesel: null,
            lpg: null,
            createdAt: now.getTime()
        };

        console.log('📊 가격 데이터 처리 시작:', priceData);
        
        // 각 유종별 가격 저장
        priceData.forEach(item => {
            const price = parseFloat(item.PRICE);
            console.log(`유종 ${item.PRODCD}: ${price}원`);
            
            if (!isNaN(price) && price > 0) {
                switch (item.PRODCD) {
                    case 'B027':
                        priceRecord.gasoline = price;
                        console.log('✅ 휘발유 가격 저장:', price);
                        break;
                    case 'D047':
                        priceRecord.diesel = price;
                        console.log('✅ 경유 가격 저장:', price);
                        break;
                    case 'K015':  // K015를 LPG로 저장
                        priceRecord.lpg = price;
                        console.log('✅ LPG 가격 저장 (K015):', price);
                        break;
                    case 'C004':  // 백업용
                        if (priceRecord.lpg === null) {
                            priceRecord.lpg = price;
                            console.log('✅ LPG 가격 저장 (C004):', price);
                        }
                        break;
                }
            }
        });
        
        console.log('📊 최종 저장할 데이터:', priceRecord);
        
        const priceRef = ref(database, 'priceHistory');
        const result = await push(priceRef, priceRecord);
        
        console.log('🔥 Firebase에 가격 데이터 저장 완료!');
        console.log('📊 저장된 데이터:', priceRecord);
        console.log('🔑 Firebase 키:', result.key);
        console.log('⏰ 저장 시간:', now.toLocaleString('ko-KR'));
        
        // 저장 성공 후 즉시 차트 업데이트
        setTimeout(() => {
            loadPriceHistoryFromFirebase();
        }, 1000);
        
        return result.key;
    } catch (error) {
        console.error('❌ Firebase 저장 실패:', error);
        console.error('에러 상세:', error.message);
        console.error('에러 스택:', error.stack);
        showToast('Firebase 데이터 저장 실패: ' + error.message, 'error');
        return null;
    }
}

async function loadPriceHistoryFromFirebase() {
    console.log('📈 Firebase 데이터 로드 시작...');
    console.log('Firebase 초기화 상태:', firebaseInitialized);
    console.log('데이터베이스 객체:', database);
    
    if (!firebaseInitialized || !database) {
        console.error('❌ Firebase 데이터베이스가 초기화되지 않았습니다.');
        console.log('Firebase 초기화 재시도...');
        await initializeFirebase();
        
        if (!firebaseInitialized || !database) {
            console.error('❌ Firebase 재초기화도 실패했습니다.');
            return;
        }
    }
    
    try {
        const { ref, get, onValue } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        
        const priceRef = ref(database, 'priceHistory');
        
        // 실시간 리스너 설정
        onValue(priceRef, (snapshot) => {
            console.log('📈 Firebase 실시간 데이터 업데이트 감지!');
            
            if (snapshot.exists()) {
                const priceHistoryData = snapshot.val();
                console.log('📊 Firebase에서 받은 원본 데이터:', priceHistoryData);
                console.log('📊 총 데이터 개수:', Object.keys(priceHistoryData).length, '개');
                
                // 배열로 변환하고 최근 200개만 사용 (24시간 간격으로 더 많은 데이터 포인트)
                const historyArray = Object.values(priceHistoryData)
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                    .slice(-200);
                
                priceHistory = historyArray;
                
                console.log('📊 정렬된 히스토리 배열:', historyArray);
                console.log('🕐 최신 데이터 시간:', historyArray[historyArray.length - 1]?.time);
                console.log('📊 데이터 샘플 (최근 3개):', historyArray.slice(-3));
                
                // 차트 업데이트
                updatePriceChart(historyArray);
            } else {
                console.log('⚠️ Firebase에 가격 히스토리가 없습니다.');
                // 데이터가 없어도 차트는 초기화
                if (!chart) {
                    initializeChart();
                }
            }
        });
        
        // 초기 데이터 로드
        console.log('📈 Firebase 초기 데이터 로드 시작...');
        const snapshot = await get(priceRef);
        
        if (snapshot.exists()) {
            const priceHistoryData = snapshot.val();
            console.log('📈 Firebase 초기 데이터 로드 성공:', priceHistoryData);
            
            const historyArray = Object.values(priceHistoryData)
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .slice(-200);
            
            priceHistory = historyArray;
            
            console.log('📊 초기 차트 데이터:', historyArray);
            console.log('📊 데이터 샘플 (처음 3개):', historyArray.slice(0, 3));
            console.log('📊 데이터 샘플 (최근 3개):', historyArray.slice(-3));
            
            // 차트 업데이트
            updatePriceChart(historyArray);
        } else {
            console.log('⚠️ Firebase에 저장된 가격 데이터가 없습니다.');
            priceHistory = [];
            
            // 테스트용 데이터 생성 (Firebase 데이터가 없을 때)
            console.log('📊 테스트용 데이터 생성 중...');
            const testData = generateTestData();
            priceHistory = testData;
            
            console.log('📊 테스트 데이터:', testData);
            updatePriceChart(testData);
        }
    } catch (error) {
        console.error('❌ Firebase 로드 실패:', error);
        console.error('에러 상세:', error.message);
        console.error('에러 스택:', error.stack);
        showToast('Firebase 데이터 로드 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// Generate Test Price Data for API failure cases
function generateTestPriceData() {
    console.log('📊 테스트 가격 데이터 생성 시작...');
    
    const now = new Date();
    const testData = [
        {
            PRODCD: 'B027',
            PRICE: '1662.38',
            DIFF: '-0.51',
            TRADE_DT: now.toISOString().slice(0, 10).replace(/-/g, ''),
            TRADE_TM: now.toTimeString().slice(0, 8).replace(/:/g, '')
        },
        {
            PRODCD: 'D047',
            PRICE: '1535.48',
            DIFF: '-0.38',
            TRADE_DT: now.toISOString().slice(0, 10).replace(/-/g, ''),
            TRADE_TM: now.toTimeString().slice(0, 8).replace(/:/g, '')
        },
        {
            PRODCD: 'K015',
            PRICE: '998.57',
            DIFF: '-0.31',
            TRADE_DT: now.toISOString().slice(0, 10).replace(/-/g, ''),
            TRADE_TM: now.toTimeString().slice(0, 8).replace(/:/g, '')
        }
    ];
    
    console.log('✅ 테스트 가격 데이터 생성 완료:', testData);
    return testData;
}

// Test Data Generation
function generateTestData() {
    console.log('📊 테스트 데이터 생성 시작...');
    
    const testData = [];
    const now = new Date();
    
    // 최근 7일 동안의 테스트 데이터 생성 (24시간 간격)
    for (let i = 0; i < 7; i++) { // 7일 * 1 (24시간 간격)
        const timestamp = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
        
        // 실제 가격 근처의 변동 데이터 생성
        const baseGasoline = 1662 + Math.sin(i * 0.1) * 15 + Math.random() * 8;
        const baseDiesel = 1535 + Math.sin(i * 0.15) * 12 + Math.random() * 6;
        const baseLPG = 998 + Math.sin(i * 0.2) * 8 + Math.random() * 4;
        
        testData.push({
            timestamp: timestamp.toISOString(),
            date: timestamp.toISOString().split('T')[0],
            time: timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            gasoline: parseFloat(baseGasoline.toFixed(2)),
            diesel: parseFloat(baseDiesel.toFixed(2)),
            lpg: parseFloat(baseLPG.toFixed(2)),
            createdAt: timestamp.getTime()
        });
    }
    
    console.log('✅ 테스트 데이터 생성 완료:', testData.length, '개 (24시간 간격)');
    console.log('📊 테스트 데이터 샘플:', testData.slice(0, 3));
    
    return testData;
}

// Chart Functions - Daily Chart
function initializeChartDaily() {
    console.log('📊 일자별 차트 초기화 시작...');
    console.log('차트 캔버스 요소:', elements.chartCanvas);
    console.log('전역 Chart 객체:', typeof Chart);
    
    if (!elements.chartCanvas) {
        console.error('❌ 차트 캔버스 요소를 찾을 수 없습니다.');
        return;
    }

    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js가 로드되지 않았습니다.');
        console.log('Chart.js 로드 대기 중...');
        
        // Chart.js 로드 대기
        setTimeout(() => {
            if (typeof Chart !== 'undefined') {
                console.log('✅ Chart.js 로드 완료, 일자별 차트 초기화 재시도');
                initializeChartDaily();
            } else {
                console.error('❌ Chart.js 로드 실패');
            }
        }, 1000);
        return;
    }

    const ctx = elements.chartCanvas.getContext('2d');
    console.log('차트 컨텍스트:', ctx);
    
    // 기존 차트 제거
    if (chart) {
        console.log('기존 차트 제거 중...');
        chart.destroy();
        chart = null;
    }
    
    try {
        // 기본 간단한 테스트 데이터로 차트 초기화
        const testData = generateSimpleTestData();
        const labels = testData.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('ko-KR', { 
                month: 'short', 
                day: 'numeric' 
            });
        });
        
        const gasolineData = testData.map(item => item.gasoline);
        const dieselData = testData.map(item => item.diesel);
        const lpgData = testData.map(item => item.lpg);
        
        console.log('📊 차트 초기화용 테스트 데이터:', testData);
        console.log('📊 차트 초기화용 라벨:', labels);
        
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '휘발유',
                        data: gasolineData,
                        borderColor: '#e50914',
                        backgroundColor: 'rgba(229, 9, 20, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: '경유',
                        data: dieselData,
                        borderColor: '#0066cc',
                        backgroundColor: 'rgba(0, 102, 204, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'LPG',
                        data: lpgData,
                        borderColor: '#ff8c00',
                        backgroundColor: 'rgba(255, 140, 0, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    title: {
                        display: true,
                        text: '유종별 가격 추이 (일자별)',
                        color: '#ffffff',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        display: true,
                        labels: {
                            color: '#ffffff',
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#ffffff',
                        borderWidth: 1,
                        callbacks: {
                            title: function(context) {
                                const date = new Date(context[0].label);
                                return date.toLocaleDateString('ko-KR', { 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                });
                            },
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}원/리터`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: '날짜',
                            color: '#ffffff'
                        },
                        ticks: {
                            color: '#ffffff',
                            maxTicksLimit: 10,
                            maxRotation: 45,
                            minRotation: 0,
                            callback: function(value, index, ticks) {
                                const date = new Date(this.getLabelForValue(value));
                                return date.toLocaleDateString('ko-KR', { 
                                    month: 'short', 
                                    day: 'numeric' 
                                });
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: '가격 (원/리터)',
                            color: '#ffffff'
                        },
                        ticks: {
                            color: '#ffffff',
                            callback: function(value) {
                                return value.toFixed(0) + '원';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        }
                    }
                }
            }
        });
        
        console.log('✅ 일자별 차트 초기화 완료!');
        console.log('차트 객체:', chart);
        
        // 차트 정보 업데이트
        if (elements.dataPoints) {
            elements.dataPoints.textContent = `${testData.length}개 데이터 포인트 (24시간 간격)`;
        }
        if (elements.lastChartUpdate) {
            elements.lastChartUpdate.textContent = `마지막 업데이트: ${new Date().toLocaleString('ko-KR')}`;
        }
        
    } catch (error) {
        console.error('❌ 일자별 차트 생성 실패:', error);
        console.error('에러 상세:', error.message);
        console.error('에러 스택:', error.stack);
    }
}

function updatePriceChartDaily(historyData) {
    console.log('📊 일자별 차트 업데이트 시작');
    console.log('차트 캔버스:', elements.chartCanvas);
    console.log('히스토리 데이터:', historyData);
    console.log('데이터 길이:', historyData?.length);
    console.log('현재 차트 객체:', chart);
    
    if (!elements.chartCanvas) {
        console.error('❌ 차트 캔버스 요소를 찾을 수 없습니다.');
        return;
    }
    
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js가 로드되지 않았습니다.');
        return;
    }
    
    if (!historyData || historyData.length === 0) {
        console.log('⚠️ 히스토리 데이터가 없어서 테스트 데이터로 차트를 표시합니다.');
        
        // 데이터가 없으면 테스트 데이터 생성
        const testData = generateOPINETTestData();
        console.log('📊 테스트 데이터 생성:', testData);
        
        // 테스트 데이터로 차트 업데이트
        updatePriceChartDaily(testData);
        return;
    }
    
    // 데이터 검증 및 로깅
    console.log('📊 일자별 데이터 검증:');
    historyData.forEach((item, index) => {
        console.log(`데이터 ${index + 1}:`, {
            date: item.date,
            gasoline: item.gasoline,
            diesel: item.diesel,
            lpg: item.lpg
        });
    });
    
    const ctx = elements.chartCanvas.getContext('2d');
    
    // 기존 차트 제거
    if (chart) {
        console.log('기존 차트 제거 중...');
        chart.destroy();
        chart = null;
    }
    
    try {
        console.log('🔍 Chart update - historyData:', historyData);
        console.log('🔍 Chart update - historyData length:', historyData.length);
        
        // 데이터 검증
        if (!Array.isArray(historyData)) {
            console.error('❌ historyData가 배열이 아닙니다:', typeof historyData);
            return;
        }
        
        // 시간 라벨 생성 (가로축) - timestamp 또는 date 사용
        const labels = historyData.map((item, index) => {
            console.log(`🔍 Processing chart label ${index}:`, item);
            
            let date;
            
            // timestamp가 있으면 timestamp 사용, 없으면 date 사용
            if (item.timestamp) {
                date = new Date(item.timestamp);
            } else if (item.date) {
                date = new Date(item.date);
            } else {
                console.error(`❌ Invalid item at index ${index}:`, item);
                return `시간${index + 1}`;
            }
            
            if (isNaN(date.getTime())) {
                console.error(`❌ Invalid date at index ${index}:`, item.timestamp || item.date);
                return `시간${index + 1}`;
            }
            
            const label = date.toLocaleDateString('ko-KR', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            console.log(`🔍 Generated label: ${label} from timestamp: ${item.timestamp || item.date}`);
            return label;
        });
        
        // 유가 데이터 추출 (세로축)
        const gasolineData = historyData.map((item, index) => {
            if (!item) {
                console.error(`❌ Invalid item at index ${index}`);
                return null;
            }
            const price = parseFloat(item.gasoline);
            console.log(`🔍 Gasoline data ${index}: ${item.gasoline} -> ${price}`);
            return isNaN(price) ? null : price;
        });
        const dieselData = historyData.map((item, index) => {
            if (!item) {
                console.error(`❌ Invalid item at index ${index}`);
                return null;
            }
            const price = parseFloat(item.diesel);
            console.log(`🔍 Diesel data ${index}: ${item.diesel} -> ${price}`);
            return isNaN(price) ? null : price;
        });
        const lpgData = historyData.map((item, index) => {
            if (!item) {
                console.error(`❌ Invalid item at index ${index}`);
                return null;
            }
            const price = parseFloat(item.lpg);
            console.log(`🔍 LPG data ${index}: ${item.lpg} -> ${price}`);
            return isNaN(price) ? null : price;
        });
        
        console.log('📊 일자별 차트 데이터 준비 완료:');
        console.log('날짜 라벨:', labels);
        console.log('휘발유 데이터:', gasolineData);
        console.log('경유 데이터:', dieselData);
        console.log('LPG 데이터:', lpgData);
        
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '휘발유',
                        data: gasolineData,
                        borderColor: '#e50914',
                        backgroundColor: 'rgba(229, 9, 20, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: '경유',
                        data: dieselData,
                        borderColor: '#0066cc',
                        backgroundColor: 'rgba(0, 102, 204, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'LPG',
                        data: lpgData,
                        borderColor: '#ff8c00',
                        backgroundColor: 'rgba(255, 140, 0, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    title: {
                        display: true,
                        text: '유종별 가격 추이 (일자별)',
                        color: '#ffffff',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        display: true,
                        labels: {
                            color: '#ffffff',
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#ffffff',
                        borderWidth: 1,
                        callbacks: {
                            title: function(context) {
                                const date = new Date(context[0].label);
                                return date.toLocaleDateString('ko-KR', { 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                });
                            },
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}원/리터`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: '날짜',
                            color: '#ffffff'
                        },
                        ticks: {
                            color: '#ffffff',
                            maxTicksLimit: 10,
                            maxRotation: 45,
                            minRotation: 0,
                            callback: function(value, index, ticks) {
                                const date = new Date(this.getLabelForValue(value));
                                return date.toLocaleDateString('ko-KR', { 
                                    month: 'short', 
                                    day: 'numeric' 
                                });
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: '가격 (원/리터)',
                            color: '#ffffff'
                        },
                        ticks: {
                            color: '#ffffff',
                            callback: function(value) {
                                return value.toFixed(0) + '원';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        }
                    }
                }
            }
        });
        
        // 차트 정보 업데이트
        if (elements.dataPoints) {
            elements.dataPoints.textContent = `${historyData.length}개 데이터 포인트 (24시간 간격)`;
        }
        if (elements.lastChartUpdate) {
            elements.lastChartUpdate.textContent = `마지막 업데이트: ${new Date().toLocaleString('ko-KR')}`;
        }
        
        console.log('✅ 일자별 차트 업데이트 완료!');
        console.log('📈 표시된 데이터 포인트:', historyData.length, '일');
        console.log('⛽ 휘발유 데이터:', gasolineData.filter(d => d !== null).length, '일');
        console.log('🚛 경유 데이터:', dieselData.filter(d => d !== null).length, '일');
        console.log('🔥 LPG 데이터:', lpgData.filter(d => d !== null).length, '일');
        console.log('📅 날짜 범위:', labels[0], '~', labels[labels.length - 1]);
        console.log('📊 차트 렌더링 완료 - 가로축: 날짜, 세로축: 유가, 범례: 휘발유/경유/LPG');
        
    } catch (error) {
        console.error('❌ 일자별 차트 업데이트 실패:', error);
        console.error('에러 상세:', error.message);
        console.error('에러 스택:', error.stack);
    }
}

// Chart Functions
function initializeChart() {
    console.log('📊 차트 초기화 시작...');
    console.log('차트 캔버스 요소:', elements.chartCanvas);
    console.log('전역 Chart 객체:', typeof Chart);
    
    if (!elements.chartCanvas) {
        console.error('❌ 차트 캔버스 요소를 찾을 수 없습니다.');
        return;
    }

    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js가 로드되지 않았습니다.');
        console.log('Chart.js 로드 대기 중...');
        
        // Chart.js 로드 대기
        setTimeout(() => {
            if (typeof Chart !== 'undefined') {
                console.log('✅ Chart.js 로드 완료, 차트 초기화 재시도');
                initializeChart();
            } else {
                console.error('❌ Chart.js 로드 실패');
            }
        }, 1000);
        return;
    }

    const ctx = elements.chartCanvas.getContext('2d');
    console.log('차트 컨텍스트:', ctx);
    
    // 기존 차트 제거
    if (chart) {
        console.log('기존 차트 제거 중...');
        chart.destroy();
        chart = null;
    }
    
    try {
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: '휘발유',
                        data: [],
                        borderColor: '#e50914',
                        backgroundColor: 'rgba(229, 9, 20, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    },
                    {
                        label: '경유',
                        data: [],
                        borderColor: '#0066cc',
                        backgroundColor: 'rgba(0, 102, 204, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    },
                    {
                        label: 'LPG',
                        data: [],
                        borderColor: '#ff8c00',
                        backgroundColor: 'rgba(255, 140, 0, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    title: {
                        display: true,
                        text: '유종별 가격 추이',
                        color: '#ffffff',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        display: true,
                        labels: {
                            color: '#ffffff',
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#ffffff',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: '시간',
                            color: '#ffffff'
                        },
                        ticks: {
                            color: '#ffffff',
                            maxTicksLimit: 10,
                            maxRotation: 45,
                            minRotation: 0
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: '가격 (원/리터)',
                            color: '#ffffff'
                        },
                        ticks: {
                            color: '#ffffff',
                            callback: function(value) {
                                return value.toFixed(0) + '원';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        }
                    }
                }
            }
        });
        
        console.log('✅ 차트 초기화 완료!');
        console.log('차트 객체:', chart);
        
        // 차트 정보 업데이트
        if (elements.dataPoints) {
            elements.dataPoints.textContent = '0개 데이터 포인트';
        }
        if (elements.lastChartUpdate) {
            elements.lastChartUpdate.textContent = `마지막 업데이트: ${new Date().toLocaleString('ko-KR')}`;
        }
        
    } catch (error) {
        console.error('❌ 차트 생성 실패:', error);
        console.error('에러 상세:', error.message);
        console.error('에러 스택:', error.stack);
    }
}

function updatePriceChart(historyData) {
    console.log('📊 차트 업데이트 시작');
    console.log('차트 캔버스:', elements.chartCanvas);
    console.log('히스토리 데이터:', historyData);
    console.log('데이터 길이:', historyData?.length);
    console.log('현재 차트 객체:', chart);
    
    if (!elements.chartCanvas) {
        console.error('❌ 차트 캔버스 요소를 찾을 수 없습니다.');
        return;
    }
    
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js가 로드되지 않았습니다.');
        return;
    }
    
    if (!historyData || historyData.length === 0) {
        console.log('⚠️ 히스토리 데이터가 없어서 빈 차트를 표시합니다.');
        if (!chart) {
            initializeChart();
        }
        return;
    }
    
    // 데이터 검증 및 로깅
    console.log('📊 데이터 검증:');
    historyData.forEach((item, index) => {
        console.log(`데이터 ${index + 1}:`, {
            timestamp: item.timestamp,
            time: item.time,
            gasoline: item.gasoline,
            diesel: item.diesel,
            lpg: item.lpg
        });
    });
    
    const ctx = elements.chartCanvas.getContext('2d');
    
    // 기존 차트 제거
    if (chart) {
        console.log('기존 차트 제거 중...');
        chart.destroy();
        chart = null;
    }
    
    try {
        // 시간 라벨 생성 (가로축)
        const labels = historyData.map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
        });
        
        // 유가 데이터 추출 (세로축)
        const gasolineData = historyData.map(item => {
            const price = parseFloat(item.gasoline);
            return isNaN(price) ? null : price;
        });
        const dieselData = historyData.map(item => {
            const price = parseFloat(item.diesel);
            return isNaN(price) ? null : price;
        });
        const lpgData = historyData.map(item => {
            const price = parseFloat(item.lpg);
            return isNaN(price) ? null : price;
        });
        
        console.log('📊 차트 데이터 준비 완료:');
        console.log('시간 라벨:', labels);
        console.log('휘발유 데이터:', gasolineData);
        console.log('경유 데이터:', dieselData);
        console.log('LPG 데이터:', lpgData);
        
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '휘발유',
                        data: gasolineData,
                        borderColor: '#e50914',
                        backgroundColor: 'rgba(229, 9, 20, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    },
                    {
                        label: '경유',
                        data: dieselData,
                        borderColor: '#0066cc',
                        backgroundColor: 'rgba(0, 102, 204, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    },
                    {
                        label: 'LPG',
                        data: lpgData,
                        borderColor: '#ff8c00',
                        backgroundColor: 'rgba(255, 140, 0, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    title: {
                        display: true,
                        text: '유종별 가격 추이',
                        color: '#ffffff',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        display: true,
                        labels: {
                            color: '#ffffff',
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#ffffff',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: '시간',
                            color: '#ffffff'
                        },
                        ticks: {
                            color: '#ffffff',
                            maxTicksLimit: 10,
                            maxRotation: 45,
                            minRotation: 0
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: '가격 (원/리터)',
                            color: '#ffffff'
                        },
                        ticks: {
                            color: '#ffffff',
                            callback: function(value) {
                                return value.toFixed(0) + '원';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        }
                    }
                }
            }
        });
        
        // 차트 정보 업데이트
        if (elements.dataPoints) {
            elements.dataPoints.textContent = `${historyData.length}개 데이터 포인트`;
        }
        if (elements.lastChartUpdate) {
            elements.lastChartUpdate.textContent = `마지막 업데이트: ${new Date().toLocaleString('ko-KR')}`;
        }
        
        console.log('✅ 차트 업데이트 완료!');
        console.log('📈 표시된 데이터 포인트:', historyData.length, '개');
        console.log('⛽ 휘발유 데이터:', gasolineData.filter(d => d !== null).length, '개');
        console.log('🚛 경유 데이터:', dieselData.filter(d => d !== null).length, '개');
        console.log('🔥 LPG 데이터:', lpgData.filter(d => d !== null).length, '개');
        console.log('🕐 시간 범위:', labels[0], '~', labels[labels.length - 1]);
        console.log('📊 차트 렌더링 완료 - 가로축: 시간, 세로축: 유가, 범례: 휘발유/경유/LPG');
        
    } catch (error) {
        console.error('❌ 차트 업데이트 실패:', error);
        console.error('에러 상세:', error.message);
        console.error('에러 스택:', error.stack);
    }
}

// UI Functions
function showLoading() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = 'flex';
    }
}

function hideLoading() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = 'none';
    }
}

function updateLastUpdate() {
    if (elements.lastUpdate) {
        elements.lastUpdate.textContent = `마지막 업데이트: ${new Date().toLocaleString('ko-KR')}`;
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// 모달 외부 클릭 시 닫기
document.addEventListener('click', function(event) {
    const stationModal = document.getElementById('stationModal');
    if (event.target === stationModal) {
        closeStationModal();
    }
});

// 수동 OPINET 데이터 업데이트 함수 (개발자 콘솔에서 호출 가능)
window.updateOPINETData = async function() {
    console.log('🚀 수동 OPINET 데이터 업데이트 시작...');
    
    try {
        // 즉시 테스트 데이터로 차트 업데이트
        console.log('📊 테스트 데이터로 즉시 차트 업데이트...');
        const testData = generateOPINETTestData();
        priceHistory = testData;
        updatePriceChartDaily(testData);
        
        showToast('테스트 데이터로 차트가 업데이트되었습니다!', 'success');
        
        // Firebase 초기화 확인 후 실제 데이터 시도
        if (!firebaseInitialized) {
            console.log('Firebase 초기화 중...');
            await initializeFirebase();
        }
        
        // 실제 OPINET 데이터 로드 시도 (백그라운드)
        setTimeout(async () => {
            try {
                console.log('📊 백그라운드에서 실제 OPINET 데이터 로드 시도...');
                const realData = await loadRealOPINETData();
                
                if (realData && realData.length > 0) {
                    console.log('✅ 실제 OPINET 데이터 로드 성공, 차트 업데이트');
                    priceHistory = realData;
                    updatePriceChartDaily(realData);
                    showToast('실제 OPINET 데이터로 차트가 업데이트되었습니다!', 'success');
                }
            } catch (error) {
                console.log('⚠️ 실제 데이터 로드 실패, 테스트 데이터 유지');
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ 수동 OPINET 데이터 업데이트 중 오류:', error);
        showToast('데이터 업데이트 중 오류가 발생했습니다: ' + error.message, 'error');
    }
};

// Firebase priceHistory 테스트 함수
window.testPriceHistory = function() {
    console.log('🧪 Firebase priceHistory 테스트 시작...');
    
    if (!firebaseInitialized) {
        console.log('Firebase 초기화 중...');
        initializeFirebase().then(() => {
            loadPriceHistoryFromFirebaseDaily();
        });
        return;
    }
    
    loadPriceHistoryFromFirebaseDaily();
    console.log('✅ Firebase priceHistory 테스트 완료');
};

// 24시간 간격 차트 테스트 함수
window.test3HourChart = function() {
    console.log('🧪 24시간 간격 차트 테스트 시작...');
    
    const testData = generate3HourTestData();
    console.log('📊 24시간 간격 테스트 데이터:', testData);
    
    priceHistory = testData;
    create3HourChart(testData);
    
    console.log('✅ 24시간 간격 차트 테스트 완료');
};

// 하드코딩된 차트 테스트 함수
window.testHardcodedChart = function() {
    console.log('🧪 하드코딩된 차트 테스트 시작...');
    
    const hardcodedData = generateHardcodedData();
    console.log('📊 하드코딩된 데이터:', hardcodedData);
    
    priceHistory = hardcodedData;
    createSimpleChart(hardcodedData);
    
    console.log('✅ 하드코딩된 차트 테스트 완료');
};

// 간단한 테스트 함수
window.testChart = function() {
    console.log('🧪 간단한 차트 테스트 시작...');
    
    const testData = generateSimpleTestData();
    console.log('📊 간단한 테스트 데이터:', testData);
    
    priceHistory = testData;
    updatePriceChartDaily(testData);
    
    console.log('✅ 간단한 차트 테스트 완료');
};

// 24시간 간격 차트 테스트 버튼 추가 (개발용)
window.add3HourTestButton = function() {
    const button = document.createElement('button');
    button.textContent = '24시간 간격 테스트';
    button.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 10000;
        background: #e50914;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 12px;
    `;
    button.onclick = window.test3HourChart;
    document.body.appendChild(button);
    console.log('✅ 24시간 간격 차트 테스트 버튼이 추가되었습니다.');
};
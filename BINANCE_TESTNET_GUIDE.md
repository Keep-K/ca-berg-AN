# 🧪 Binance Spot Testnet 거래 테스트 가이드

이 가이드는 Binance Spot Testnet을 사용하여 실제 주문 실행을 테스트하는 방법을 설명합니다.

## 📋 사전 준비

### 1. Binance Spot Testnet API 키 발급

1. **Testnet 웹사이트 접속**
   - https://testnet.binance.vision/ 접속
   - 또는 https://testnet.binance.vision/en/my/settings/api-management

2. **API 키 생성**
   - "Generate HMAC_SHA256 Key" 클릭
   - API Key와 Secret Key를 안전한 곳에 저장
   - ⚠️ **주의**: Secret Key는 한 번만 표시되므로 반드시 저장하세요!

3. **권한 확인**
   - Testnet은 기본적으로 모든 권한이 활성화되어 있습니다
   - Spot Trading 권한이 있는지 확인

---

## 🚀 테스트 방법

### 방법 1: UI를 통한 테스트 (권장)

#### Step 1: 백엔드 서버 시작

```bash
cd "/home/jason/Desktop/bloomberg software"
npm run dev
```

백엔드가 `http://localhost:3000`에서 실행됩니다.

#### Step 2: 프론트엔드 서버 시작

```bash
cd frontend
npm run dev
```

프론트엔드가 `http://localhost:5173`에서 실행됩니다.

#### Step 3: 거래소 등록

1. 브라우저에서 `http://localhost:5173` 접속
2. 좌측 사이드바에서 **"Exchanges"** 클릭
3. **"Connect Exchange"** 버튼 클릭
4. Binance 선택
5. **"Use Sandbox/Testnet"** 체크박스 ✅ **반드시 체크**
6. Testnet API Key와 Secret Key 입력
7. **"Connect"** 버튼 클릭

**성공 메시지 확인:**
```
✓ Exchange registered successfully
```

#### Step 4: 거래 실행

1. 좌측 사이드바에서 **"Trading"** 클릭
2. 거래소 선택: **Binance** 선택
3. 주문 정보 입력:
   - **Symbol**: `BTCUSDT` (또는 다른 거래 쌍)
   - **Side**: BUY 또는 SELL 선택
   - **Type**: 
     - **Market**: 즉시 체결 (가격 입력 불필요)
     - **Limit**: 지정가 주문 (가격 입력 필요)
   - **Quantity**: 주문 수량 (예: `0.001`)
   - **Price**: Limit 주문인 경우만 입력 (예: `50000`)

4. **"BUY BTCUSDT"** 또는 **"SELL BTCUSDT"** 버튼 클릭

#### Step 5: 실시간 업데이트 확인

- **Open Orders** 테이블에서 주문 상태 확인
- 주문이 체결되면 자동으로 업데이트됩니다
- WebSocket을 통해 실시간으로 주문 상태와 잔액 변경이 반영됩니다

---

### 방법 2: API를 직접 호출하는 방법

#### Step 1: 거래소 등록

```bash
curl -X POST http://localhost:3000/api/exchanges/register \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "apiKey": "YOUR_TESTNET_API_KEY",
    "apiSecret": "YOUR_TESTNET_SECRET_KEY",
    "sandbox": true
  }'
```

#### Step 2: 계정 정보 확인

```bash
curl http://localhost:3000/api/binance/account
```

#### Step 3: Market 주문 실행

```bash
curl -X POST http://localhost:3000/api/binance/order \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "side": "BUY",
    "type": "MARKET",
    "quantity": "0.001"
  }'
```

#### Step 4: Limit 주문 실행

```bash
curl -X POST http://localhost:3000/api/binance/order \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "side": "BUY",
    "type": "LIMIT",
    "quantity": "0.001",
    "price": "50000",
    "timeInForce": "GTC"
  }'
```

#### Step 5: Open Orders 확인

```bash
curl "http://localhost:3000/api/trade/open-orders?exchange=binance"
```

---

## ⚠️ 주의사항

1. **Testnet 자금**
   - Testnet은 가상 자금을 사용합니다
   - 실제 자금이 사용되지 않습니다
   - Testnet 잔액은 별도로 관리됩니다

2. **API 키 보안**
   - Testnet API 키도 절대 공유하지 마세요
   - 환경 변수나 `.env` 파일에 저장하세요
   - Git에 커밋하지 마세요

3. **Sandbox 모드**
   - 거래소 등록 시 **반드시 `sandbox: true`** 설정
   - UI에서 "Use Sandbox/Testnet" 체크박스 확인

4. **주문 수량**
   - Testnet은 최소 주문 수량이 다를 수 있습니다
   - BTCUSDT의 경우 일반적으로 `0.001` 이상

5. **가격 정확도**
   - Limit 주문의 가격은 현재 시장가와 유사하게 설정해야 체결 가능합니다
   - 너무 낮은 가격으로 매수 주문을 넣으면 체결되지 않을 수 있습니다

---

## 🐛 문제 해결

### 문제 1: "Exchange not registered for trading"

**해결 방법:**
- 거래소 등록 시 `sandbox: true`로 설정했는지 확인
- 백엔드 콘솔에서 다음 메시지 확인:
  ```
  [API] ✓ Successfully registered binance for trading execution
  ```

### 문제 2: "Request failed with status code 401"

**해결 방법:**
- API Key와 Secret Key가 올바른지 확인
- Testnet API 키인지 확인 (프로덕션 키가 아님)
- API 키에 거래 권한이 있는지 확인

### 문제 3: "Order rejected by risk manager"

**해결 방법:**
- 주문 수량이 너무 큰지 확인
- 잔액이 충분한지 확인 (`GET /api/binance/account`)

### 문제 4: 실시간 업데이트가 안 옴

**해결 방법:**
- 백엔드 콘솔에서 다음 메시지 확인:
  ```
  [Binance] Spot User Data Stream WebSocket connected
  ```
- WebSocket 연결 상태 확인
- Listen Key가 자동으로 갱신되는지 확인 (30분마다)

---

**행운을 빕니다! 🚀**

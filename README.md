# Multi-Exchange Portfolio Monitoring Platform

**Phase 1: Read-Only Monitoring System**

프로페셔널 암호화폐 트레이딩 데스크를 위한 멀티 거래소 포트폴리오 모니터링 플랫폼의 1단계 구축입니다.

## 🎯 목표

여러 거래소 계정을 연결하여 다음을 모니터링:
- 잔액 (Balances)
- 포지션 (Positions)
- 주문 (Orders)
- 거래 내역 (Trade History)

모든 데이터는 통합 포트폴리오 뷰로 집계됩니다.

## 🏗 시스템 아키텍처

```
Exchange APIs
    ↓
Exchange Connector Layer
    ↓
Normalization Engine
    ↓
Portfolio Aggregation Service
    ↓
REST/WebSocket API for Dashboard
```

## 📁 프로젝트 구조

```
/connectors      - 거래소 커넥터 (Binance, Bybit, OKX, Coinbase)
/normalizer      - 데이터 정규화 엔진
/portfolio       - 포트폴리오 집계 서비스
/realtime        - 실시간 모니터링 엔진
/security        - API 키 보안 관리
/api             - REST API 및 WebSocket 서버
/types           - 타입 정의
/config          - 설정 관리
```

## 🚀 시작하기

### Docker Compose로 데이터베이스 시작 (권장)

**최신 Docker (Docker Desktop 또는 Docker Engine 20.10+) 사용:**
```bash
docker compose up -d
```

**구버전 Docker 또는 docker-compose 별도 설치:**
```bash
# docker-compose 설치 (Ubuntu/Debian)
sudo apt install docker-compose

# 또는 snap으로 설치
sudo snap install docker

# 설치 후 실행
docker-compose up -d
```

이 명령은 다음을 자동으로 설정합니다:
- PostgreSQL (포트 5432)
- Redis (포트 6379)
- 데이터베이스 스키마 자동 초기화

**데이터베이스 상태 확인:**
```bash
# 최신 Docker
docker compose ps

# 구버전
docker-compose ps
```

**데이터베이스 중지:**
```bash
# 최신 Docker
docker compose down

# 구버전
docker-compose down
```

### 수동 설정

1. 의존성 설치
```bash
npm install
```

2. 환경 변수 설정
```bash
cp .env.example .env
# .env 파일을 편집하여 설정값 입력
```

3. 빌드
```bash
npm run build
```

4. 개발 모드 실행
```bash
npm run dev
```

5. 프로덕션 실행
```bash
npm start
```

## 📝 지원 거래소

- Binance (Spot + Futures)
  - **Spot Testnet 지원**: 테스트 환경에서 실제 주문 실행 가능
  - Testnet API 키: https://testnet.binance.vision/
- Bybit (Derivatives)
- OKX (Unified Account)
- Coinbase

## 📡 API 엔드포인트

### REST API

- `GET /api/health` - 서버 상태 확인
- `GET /api/exchanges` - 등록된 거래소 목록
- `GET /api/portfolio/snapshot` - 현재 포트폴리오 스냅샷 조회
- `GET /api/portfolio/snapshot/latest` - 최신 캐시된 스냅샷 조회
- `GET /api/portfolio/summary` - 포트폴리오 요약 통계
- `POST /api/exchanges/register` - 새 거래소 등록
  ```json
  {
    "exchange": "binance",
    "apiKey": "your_api_key",
    "apiSecret": "your_api_secret",
    "sandbox": false
  }
  ```
- `DELETE /api/exchanges/:exchange` - 거래소 제거

### Binance Spot Testnet Trading API

**⚠️ 테스트넷 전용 - 실제 자금이 사용되지 않습니다**

- `GET /api/binance/account` - Binance Spot 계정 정보 조회
  ```json
  {
    "balances": [...],
    "totalValue": 10000.50,
    "exchange": "binance"
  }
  ```

- `POST /api/binance/order` - Binance Spot 주문 실행
  ```json
  {
    "symbol": "BTCUSDT",
    "side": "BUY",
    "type": "MARKET",
    "quantity": "0.001"
  }
  ```
  
  Limit 주문의 경우:
  ```json
  {
    "symbol": "BTCUSDT",
    "side": "BUY",
    "type": "LIMIT",
    "quantity": "0.001",
    "price": "50000",
    "timeInForce": "GTC"
  }
  ```

- `POST /api/binance/listen-key` - User Data Stream Listen Key 생성
- `PUT /api/binance/listen-key` - Listen Key 갱신 (Keep Alive)
- `DELETE /api/binance/listen-key?listenKey=xxx` - User Data Stream 종료

### Trading API

- `POST /api/trade/order` - 주문 실행
- `POST /api/trade/cancel` - 주문 취소
- `POST /api/trade/cancel-all` - 모든 주문 취소
- `GET /api/trade/open-orders` - 오픈 주문 조회
- `GET /api/trade/history` - 주문 내역 조회
- `GET /api/trade/trades` - 거래 내역 조회

## ⚠️ 주의사항

- **Binance Spot Testnet**: 테스트 환경에서 실제 주문 실행이 가능합니다 (가상 자금 사용)
- **프로덕션 거래**: 프로덕션 환경에서는 실제 자금이 사용되므로 주의하세요
- **API 키 보안**: API 키는 암호화되어 저장되며, 프론트엔드에 노출되지 않습니다
- **User Data Stream**: 실시간 주문 실행 및 잔액 업데이트를 위해 WebSocket을 통해 전달됩니다

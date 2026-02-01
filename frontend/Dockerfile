# React 프론트엔드 개발 환경 Dockerfile
FROM node:20-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm install

# 애플리케이션 코드 복사
COPY . .

# React 개발 서버 포트
EXPOSE 3000

# 개발 서버 실행 (핫 리로드 활성화)
CMD ["npm", "start"]

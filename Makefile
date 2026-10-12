.DEFAULT_GOAL := help

# Extra test arguments, e.g. make test-unit ARGS="tests/integration/session/login-page.spec.ts"
ARGS ?=

.PHONY: help install install-frontend tidy-backend dev dev-frontend dev-backend \
	build build-frontend build-backend sync-web-assets lint test test-unit test-backend test-e2e

help: ## 列出可用命令
	@awk 'BEGIN { printf "Usage: make <target> [ARGS=\"...\"]\n\n" } /^[a-zA-Z0-9_-]+:.*## / { split($$0, parts, ":.*## "); printf "  %-20s %s\n", parts[1], parts[2] }' $(MAKEFILE_LIST)

install: install-frontend tidy-backend ## 安装前端依赖并整理后端 Go 模块

install-frontend: ## 安装前端依赖
	npm run install:frontend

tidy-backend: ## 整理后端 Go 模块
	npm run tidy:backend

dev: ## 同时启动前端和本地后端（Ctrl+C 停止两侧）
	npm run dev

dev-frontend: ## 仅启动前端开发服务器
	npm run dev:frontend

dev-backend: ## 仅启动后端开发服务器
	npm run dev:backend

build: ## 构建前端、同步静态资源并编译后端
	npm run build

build-frontend: ## 检查前端类型并构建前端
	npm run build:frontend

build-backend: ## 同步前端静态资源并编译后端（需已有前端构建产物）
	npm run build:backend

sync-web-assets: ## 将前端构建产物同步到后端内嵌资源目录
	npm run sync:web-assets

lint: ## 运行前端 ESLint
	npm run lint

test: test-unit test-backend ## 运行前端 Vitest 和后端 Go 测试

test-unit: ## 运行全部 Vitest 测试一次，可通过 ARGS 指定 spec
	npm --prefix fastnote run test:unit -- --run $(ARGS)

test-backend: ## 运行后端 Go 测试，可通过 ARGS 添加测试参数
	node scripts/go-backend.mjs test ./... $(ARGS)

test-e2e: ## 运行 Cypress 测试（需先启动开发环境），支持 ARGS
	npm --prefix fastnote run test:e2e -- $(ARGS)

# 云部署指南 (Cloud Deployment Guide)

本文档描述如何将实时语音翻译应用及其辅助服务部署到各大云平台。

## 目录

- [概述](#概述)
- [AWS 部署](#aws-部署)
- [Azure 部署](#azure-部署)
- [Google Cloud 部署](#google-cloud-部署)
- [阿里云部署](#阿里云部署)
- [成本估算](#成本估算)
- [最佳实践](#最佳实践)

## 概述

### 云部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户设备                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │     实时语音翻译应用 (桌面应用)                    │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS/WSS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      云服务平台                              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ CDN/负载均衡 │  │  API Gateway │  │  对象存储    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ 更新服务器   │  │ 信令服务器   │  │ 静态资源     │     │
│  │ (Nginx)      │  │ (WebSocket)  │  │ (安装包)     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                                │
│         ▼                  ▼                                │
│  ┌──────────────┐  ┌──────────────┐                       │
│  │  数据库      │  │  监控日志    │                       │
│  │  (RDS)       │  │  (CloudWatch)│                       │
│  └──────────────┘  └──────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### 部署组件

1. **桌面应用**: 分发给最终用户，安装在本地设备
2. **更新服务器**: 提供应用自动更新
3. **信令服务器**: WebRTC 信令协调
4. **静态资源**: 安装包、模型文件等
5. **API 服务**: 可选的后端 API（如果需要）

## AWS 部署

### 架构图

```
Internet
    │
    ▼
CloudFront (CDN)
    │
    ├─► S3 (静态资源/安装包)
    │
    ├─► ALB (负载均衡器)
    │       │
    │       ├─► ECS/Fargate (信令服务器)
    │       │       │
    │       │       └─► RDS (数据库)
    │       │
    │       └─► ECS/Fargate (更新服务器)
    │
    └─► API Gateway (可选)
            │
            └─► Lambda (无服务器函数)
```

### 1. S3 静态资源托管

**创建 S3 存储桶:**

```bash
# 使用 AWS CLI
aws s3 mb s3://rtv-updates-bucket --region us-east-1

# 配置公共访问
aws s3api put-bucket-policy --bucket rtv-updates-bucket --policy file://bucket-policy.json
```

**bucket-policy.json:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::rtv-updates-bucket/*"
    }
  ]
}
```

**上传文件:**

```bash
# 上传安装包
aws s3 cp ./dist/windows/ s3://rtv-updates-bucket/windows/ --recursive
aws s3 cp ./dist/linux/ s3://rtv-updates-bucket/linux/ --recursive

# 设置缓存策略
aws s3 cp latest.json s3://rtv-updates-bucket/ \
  --cache-control "max-age=300" \
  --content-type "application/json"
```

### 2. CloudFront CDN 配置

**创建 CloudFront 分发:**

```bash
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

**cloudfront-config.json:**

```json
{
  "CallerReference": "rtv-updates-2024",
  "Comment": "RTV Updates Distribution",
  "Enabled": true,
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-rtv-updates",
        "DomainName": "rtv-updates-bucket.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-rtv-updates",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    },
    "Compress": true,
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000
  }
}
```

### 3. ECS/Fargate 部署信令服务器

**创建 ECS 集群:**

```bash
aws ecs create-cluster --cluster-name rtv-cluster
```

**任务定义 (task-definition.json):**

```json
{
  "family": "rtv-signaling",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "signaling-server",
      "image": "your-account.dkr.ecr.us-east-1.amazonaws.com/rtv-signaling:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "8080"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/rtv-signaling",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

**注册任务定义:**

```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

**创建服务:**

```bash
aws ecs create-service \
  --cluster rtv-cluster \
  --service-name rtv-signaling-service \
  --task-definition rtv-signaling \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

### 4. Application Load Balancer

**创建 ALB:**

```bash
aws elbv2 create-load-balancer \
  --name rtv-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx \
  --scheme internet-facing \
  --type application
```

**创建目标组:**

```bash
aws elbv2 create-target-group \
  --name rtv-signaling-tg \
  --protocol HTTP \
  --port 8080 \
  --vpc-id vpc-xxx \
  --target-type ip \
  --health-check-path /health
```

**创建监听器:**

```bash
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:... \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

### 5. RDS 数据库（可选）

```bash
aws rds create-db-instance \
  --db-instance-identifier rtv-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password YourPassword123 \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxx \
  --db-subnet-group-name rtv-db-subnet-group
```

### 6. CloudWatch 监控

**创建日志组:**

```bash
aws logs create-log-group --log-group-name /ecs/rtv-signaling
```

**创建告警:**

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name rtv-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

### 7. 使用 Terraform 自动化部署

**main.tf:**

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# S3 存储桶
resource "aws_s3_bucket" "updates" {
  bucket = "rtv-updates-bucket"
}

resource "aws_s3_bucket_public_access_block" "updates" {
  bucket = aws_s3_bucket.updates.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# CloudFront 分发
resource "aws_cloudfront_distribution" "updates" {
  enabled = true
  comment = "RTV Updates Distribution"

  origin {
    domain_name = aws_s3_bucket.updates.bucket_regional_domain_name
    origin_id   = "S3-rtv-updates"
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-rtv-updates"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# ECS 集群
resource "aws_ecs_cluster" "main" {
  name = "rtv-cluster"
}

# ECS 任务定义
resource "aws_ecs_task_definition" "signaling" {
  family                   = "rtv-signaling"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"

  container_definitions = jsonencode([
    {
      name  = "signaling-server"
      image = "your-account.dkr.ecr.us-east-1.amazonaws.com/rtv-signaling:latest"
      portMappings = [
        {
          containerPort = 8080
          protocol      = "tcp"
        }
      ]
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        }
      ]
    }
  ])
}

# ECS 服务
resource "aws_ecs_service" "signaling" {
  name            = "rtv-signaling-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.signaling.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_a.id, aws_subnet.public_b.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.signaling.arn
    container_name   = "signaling-server"
    container_port   = 8080
  }
}

# 输出
output "cloudfront_domain" {
  value = aws_cloudfront_distribution.updates.domain_name
}

output "alb_dns" {
  value = aws_lb.main.dns_name
}
```

**部署:**

```bash
# 初始化 Terraform
terraform init

# 查看计划
terraform plan

# 应用配置
terraform apply
```

## Azure 部署

### 架构图

```
Internet
    │
    ▼
Azure Front Door (CDN)
    │
    ├─► Blob Storage (静态资源)
    │
    ├─► Application Gateway
    │       │
    │       ├─► Container Instances (信令服务器)
    │       │       │
    │       │       └─► Azure Database (PostgreSQL)
    │       │
    │       └─► App Service (更新服务器)
    │
    └─► API Management (可选)
```

### 1. Azure Blob Storage

**创建存储账户:**

```bash
# 使用 Azure CLI
az storage account create \
  --name rtvupdates \
  --resource-group rtv-rg \
  --location eastus \
  --sku Standard_LRS

# 创建容器
az storage container create \
  --name updates \
  --account-name rtvupdates \
  --public-access blob
```

**上传文件:**

```bash
# 上传安装包
az storage blob upload-batch \
  --destination updates \
  --source ./dist \
  --account-name rtvupdates
```

### 2. Azure Container Instances

**部署信令服务器:**

```bash
az container create \
  --resource-group rtv-rg \
  --name rtv-signaling \
  --image your-registry.azurecr.io/rtv-signaling:latest \
  --cpu 1 \
  --memory 1 \
  --ports 8080 \
  --dns-name-label rtv-signaling \
  --environment-variables NODE_ENV=production PORT=8080
```

### 3. Azure Front Door

**创建 Front Door:**

```bash
az network front-door create \
  --resource-group rtv-rg \
  --name rtv-frontdoor \
  --backend-address rtvupdates.blob.core.windows.net
```

### 4. 使用 ARM 模板部署

**azuredeploy.json:**

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "storageAccountName": {
      "type": "string",
      "defaultValue": "rtvupdates"
    }
  },
  "resources": [
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2021-04-01",
      "name": "[parameters('storageAccountName')]",
      "location": "[resourceGroup().location]",
      "sku": {
        "name": "Standard_LRS"
      },
      "kind": "StorageV2",
      "properties": {
        "accessTier": "Hot"
      }
    }
  ]
}
```

**部署:**

```bash
az deployment group create \
  --resource-group rtv-rg \
  --template-file azuredeploy.json
```

## Google Cloud 部署

### 架构图

```
Internet
    │
    ▼
Cloud CDN
    │
    ├─► Cloud Storage (静态资源)
    │
    ├─► Cloud Load Balancing
    │       │
    │       ├─► Cloud Run (信令服务器)
    │       │       │
    │       │       └─► Cloud SQL (PostgreSQL)
    │       │
    │       └─► Cloud Run (更新服务器)
    │
    └─► API Gateway (可选)
```

### 1. Cloud Storage

**创建存储桶:**

```bash
# 使用 gcloud CLI
gsutil mb -c STANDARD -l us-east1 gs://rtv-updates/

# 设置公共访问
gsutil iam ch allUsers:objectViewer gs://rtv-updates/
```

**上传文件:**

```bash
# 上传安装包
gsutil -m cp -r ./dist/* gs://rtv-updates/

# 设置缓存
gsutil setmeta -h "Cache-Control:public, max-age=86400" gs://rtv-updates/**
```

### 2. Cloud Run 部署

**构建容器:**

```bash
# 构建并推送到 Container Registry
gcloud builds submit --tag gcr.io/your-project/rtv-signaling

# 部署到 Cloud Run
gcloud run deploy rtv-signaling \
  --image gcr.io/your-project/rtv-signaling \
  --platform managed \
  --region us-east1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1
```

### 3. Cloud CDN

**启用 CDN:**

```bash
# 创建后端存储桶
gcloud compute backend-buckets create rtv-updates-backend \
  --gcs-bucket-name=rtv-updates \
  --enable-cdn

# 创建 URL 映射
gcloud compute url-maps create rtv-url-map \
  --default-backend-bucket=rtv-updates-backend

# 创建 HTTPS 代理
gcloud compute target-https-proxies create rtv-https-proxy \
  --url-map=rtv-url-map \
  --ssl-certificates=rtv-ssl-cert

# 创建转发规则
gcloud compute forwarding-rules create rtv-https-rule \
  --global \
  --target-https-proxy=rtv-https-proxy \
  --ports=443
```

### 4. 使用 Terraform 部署

**main.tf:**

```hcl
provider "google" {
  project = "your-project-id"
  region  = "us-east1"
}

# Cloud Storage 存储桶
resource "google_storage_bucket" "updates" {
  name     = "rtv-updates"
  location = "US"

  website {
    main_page_suffix = "index.html"
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

# Cloud Run 服务
resource "google_cloud_run_service" "signaling" {
  name     = "rtv-signaling"
  location = "us-east1"

  template {
    spec {
      containers {
        image = "gcr.io/your-project/rtv-signaling:latest"
        ports {
          container_port = 8080
        }
        resources {
          limits = {
            cpu    = "1000m"
            memory = "512Mi"
          }
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

# 允许未经身份验证的访问
resource "google_cloud_run_service_iam_member" "public" {
  service  = google_cloud_run_service.signaling.name
  location = google_cloud_run_service.signaling.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 输出
output "storage_url" {
  value = google_storage_bucket.updates.url
}

output "service_url" {
  value = google_cloud_run_service.signaling.status[0].url
}
```

## 阿里云部署

### 架构图

```
Internet
    │
    ▼
CDN (阿里云 CDN)
    │
    ├─► OSS (对象存储)
    │
    ├─► SLB (负载均衡)
    │       │
    │       ├─► ECS (信令服务器)
    │       │       │
    │       │       └─► RDS (数据库)
    │       │
    │       └─► ECS (更新服务器)
    │
    └─► API Gateway (可选)
```

### 1. OSS 对象存储

**创建存储桶:**

```bash
# 使用 ossutil
ossutil mb oss://rtv-updates

# 设置 ACL
ossutil set-acl oss://rtv-updates public-read
```

**上传文件:**

```bash
# 上传安装包
ossutil cp -r ./dist/ oss://rtv-updates/
```

### 2. ECS 实例部署

**创建 ECS 实例:**

```bash
# 使用阿里云 CLI
aliyun ecs CreateInstance \
  --RegionId cn-hangzhou \
  --ImageId ubuntu_20_04_x64 \
  --InstanceType ecs.t5-lc1m1.small \
  --SecurityGroupId sg-xxx \
  --VSwitchId vsw-xxx
```

### 3. CDN 配置

**添加 CDN 域名:**

```bash
aliyun cdn AddCdnDomain \
  --DomainName updates.example.com \
  --CdnType web \
  --Sources '[{"content":"rtv-updates.oss-cn-hangzhou.aliyuncs.com","type":"oss","priority":"20","port":80}]'
```

## 成本估算

### AWS 成本（每月）

| 服务 | 配置 | 预估成本 |
|------|------|----------|
| S3 | 100GB 存储 + 1TB 传输 | $10 |
| CloudFront | 1TB 数据传输 | $85 |
| ECS Fargate | 2 任务 (0.25 vCPU, 0.5GB) | $15 |
| ALB | 1 个负载均衡器 | $20 |
| RDS | db.t3.micro | $15 |
| **总计** | | **$145/月** |

### Azure 成本（每月）

| 服务 | 配置 | 预估成本 |
|------|------|----------|
| Blob Storage | 100GB + 1TB 传输 | $12 |
| Front Door | 1TB 数据传输 | $90 |
| Container Instances | 2 实例 (1 vCPU, 1GB) | $30 |
| Azure Database | Basic tier | $15 |
| **总计** | | **$147/月** |

### Google Cloud 成本（每月）

| 服务 | 配置 | 预估成本 |
|------|------|----------|
| Cloud Storage | 100GB + 1TB 传输 | $8 |
| Cloud CDN | 1TB 数据传输 | $80 |
| Cloud Run | 2 实例 (1 vCPU, 512MB) | $25 |
| Cloud SQL | db-f1-micro | $10 |
| **总计** | | **$123/月** |

### 成本优化建议

1. **使用预留实例** 可节省 30-50%
2. **启用自动扩缩容** 按需付费
3. **使用 Spot/Preemptible 实例** 可节省 60-90%
4. **优化数据传输** 使用 CDN 缓存
5. **定期清理未使用资源**

## 最佳实践

### 1. 安全性

- 使用 HTTPS/TLS 加密所有通信
- 启用 WAF (Web Application Firewall)
- 实施 DDoS 防护
- 定期更新安全补丁
- 使用 IAM 最小权限原则

### 2. 可用性

- 多区域部署
- 自动故障转移
- 健康检查和自动恢复
- 负载均衡
- 备份和灾难恢复

### 3. 性能

- 使用 CDN 加速内容分发
- 启用 HTTP/2 和 Brotli 压缩
- 实施缓存策略
- 数据库连接池
- 异步处理

### 4. 监控

- 设置告警和通知
- 收集和分析日志
- 性能指标监控
- 用户体验监控
- 成本监控

### 5. CI/CD

- 自动化构建和部署
- 蓝绿部署或金丝雀发布
- 自动化测试
- 回滚机制
- 版本控制

## 下一步

- 查看 [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) 了解容器化
- 查看 [KUBERNETES_DEPLOYMENT.md](KUBERNETES_DEPLOYMENT.md) 了解 K8s 部署
- 查看 [MONITORING.md](MONITORING.md) 了解监控配置
- 查看 [SECURITY.md](SECURITY.md) 了解安全最佳实践

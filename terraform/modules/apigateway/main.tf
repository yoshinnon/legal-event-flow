locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "aws_apigatewayv2_api" "main" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"
  description   = "Legal Event Flow HTTP API"

  cors_configuration {
    allow_origins = ["*"]  # 本番運用時はCloudFrontドメインに絞る
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }

  tags = { Name = "${local.name_prefix}-api" }
}

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = var.api_gateway_log_group_arn
  }
}

# ── Lambda 統合 ────────────────────────────────────────
resource "aws_apigatewayv2_integration" "api_handler" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.api_handler_arn
  payload_format_version = "2.0"
}

# ── ルート定義 ─────────────────────────────────────────
locals {
  routes = {
    "POST /documents/{slug}/versions" = "POST /documents/{slug}/versions"
    "GET /documents"                  = "GET /documents"
    "GET /documents/{slug}"           = "GET /documents/{slug}"
    "GET /documents/{slug}/versions"  = "GET /documents/{slug}/versions"
  }
}

resource "aws_apigatewayv2_route" "routes" {
  for_each  = local.routes
  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.api_handler.id}"
}

# ── Lambda 実行許可 ────────────────────────────────────
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.api_handler_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

variable "project_name"       { type = string }
variable "environment"        { type = string }
variable "is_production"      { type = bool }
variable "db_name"            { type = string; default = "legaldb" }
variable "db_min_acu"         { type = number }
variable "db_max_acu"         { type = number }
variable "private_subnet_ids" { type = list(string) }
variable "aurora_sg_id"       { type = string }

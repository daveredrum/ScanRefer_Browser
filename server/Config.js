
var Config = {};

Config.base_url = process.env.NODE_BASE_URL || "";
Config.http_port = process.env.HTTP_SERVER_PORT || 8080;

module.exports = Config;

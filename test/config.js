var log = require('winston')
  , localProviders = require('nitrogen-local-providers');

var config = {
    external_port: 3050,
    internal_port: 3050,
    protocol: 'http',
    mongodb_connection_string: "mongodb://localhost/nitrogen_test",
    web_admin_uri: "http://localhost:9000"
};

config.internal_port = config.internal_port || 3030;
config.external_port = config.external_port || 443;
config.protocol = process.env.PROTOCOL || config.protocol || "https";
config.host = process.env.HOST_NAME || config.host || "localhost";
config.mongodb_connection_string = config.mongodb_connection_string || process.env.MONGODB_CONNECTION_STRING;

// Endpoint URI configuration

config.api_path = "/api/";
config.v1_api_path = config.api_path + "v1";

config.base_endpoint = config.protocol + "://" + config.host + ":" + config.external_port;
config.api_endpoint = config.base_endpoint + config.v1_api_path;

config.subscriptions_path = '/';
config.subscriptions_endpoint = config.base_endpoint + config.subscriptions_path;

config.api_keys_path = config.v1_api_path + "/api_keys";
config.api_keys_endpoint = config.base_endpoint + config.api_keys_path;

config.blobs_path = config.v1_api_path + "/blobs";
config.blobs_endpoint = config.base_endpoint + config.blobs_path;

config.headwaiter_path = config.v1_api_path + "/headwaiter";
config.headwaiter_uri = config.base_endpoint + config.headwaiter_path;

config.messages_path = config.v1_api_path + "/messages";
config.messages_endpoint = config.base_endpoint + config.messages_path;

config.ops_path = config.v1_api_path + "/ops";
config.ops_endpoint = config.base_endpoint + config.ops_path;

config.permissions_path = config.v1_api_path + "/permissions";
config.permissions_endpoint = config.base_endpoint + config.permissions_path;

config.principals_path = config.v1_api_path + "/principals";
config.principals_endpoint = config.base_endpoint + config.principals_path;

config.users_path = "/user";
config.users_endpoint = config.base_endpoint + config.users_path;

config.user_authorize_path = config.users_path + "/authorize";
config.user_change_password_path = config.users_path + "/changepassword";
config.user_create_path = config.users_path + "/create";
config.user_decision_path = config.users_path + "/decision";
config.user_delete_account_path = config.users_path + "/delete";
config.user_login_path = config.users_path + "/login";
config.user_logout_path = config.users_path + "/logout";
config.user_reset_password_path = config.users_path + "/resetpassword";

config.default_user_redirect = "http://admin.nitrogen.io";

config.user_session_secret = process.env.USER_SESSION_SECRET || "development";
config.user_session_timeout_seconds = 30 * 24 * 60 * 60; // seconds (30 days)

// Security configuration parameters.  Make sure you know what you are doing before changing
// any of these parameters.

config.password_hash_iterations = 10000;
config.password_hash_length = 128;
config.salt_length_bytes = 64;
config.reset_password_length = 10;
config.minimum_password_length = 8;

config.auth_code_bytes = 16;
config.api_key_bytes = 16;
config.unassigned_apikey_pool_size = 10;

config.nonce_bytes = 32;
config.public_key_bits = 2048;
config.public_key_exponent = 65537;

config.device_secret_bytes = 128;

config.access_token_bytes = 32;
config.access_token_lifetime = 1; // days
config.access_token_signing_key = process.env.ACCESS_TOKEN_SIGNING_KEY || '12345678901234567890123456789012';

config.blob_cache_lifetime = 2592000; // seconds

// # of days a message should be remain in indexed storage by default
config.default_message_indexed_lifetime = 7; // days

config.permissions_for_cache_lifetime_minutes = 24 * 60; // minutes
config.principals_cache_lifetime_minutes = 24 * 60; // minutes

// when the token gets within 10% (default) of config.access_token_lifetime,
// refresh it with a new token via the response header.
config.refresh_token_threshold = 0.1;

config.request_log_format = ':remote-addr - - [:date] ":method :url HTTP/:http-version" :status :res[content-length] :response-time ":referrer" ":user-agent"';

// You can use Loggly's log service by specifying these 4 environmental variables

log.remove(log.transports.Console);
log.add(log.transports.Console, { colorize: true, timestamp: true, level: 'info' });

// Claim codes are what users use to claim devices they have added to the service when IP matching fails.
// Longer claim codes are more secure but less convienent for users.
config.claim_code_length = 8;

// run the janitor every minute
config.janitor_interval = 60 * 1000; // ms

// Validate all message schemas to conform to all core and installed schemas.
config.validate_schemas = true;

// Migration configuration
config.migrations_relative_path = "/migrations/";

// Email address that the service should use for administrative emails.
config.service_email_address = "admin@nitrogen.io";

config.service_applications = [
    { instance_id: 'claim-agent', module: 'claim-agent' },
    { instance_id: 'matcher', module: 'nitrogen-matcher' }
];

config.redis_server = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
};

console.log('archive_provider: using local storage.');
config.archive_providers = [ new localProviders.NullArchiveProvider(config, log) ];

console.log('blob_provider: using local storage.');
config.blob_storage_path = './storage';
config.blob_provider = new localProviders.LocalBlobProvider(config, log);

console.log('cache_provider: Using memory cache provider.');
config.cache_provider = new localProviders.MemoryCacheProvider(config, log);

console.log('pubsub_provider: using memory pubsub.');
config.pubsub_provider = new localProviders.MemoryPubSubProvider(config, log);

console.log('email_provider: using null provider.');
config.email_provider = new localProviders.NullEmailProvider(config, log);

// Test fixture location configuration
config.blob_fixture_path = 'test/fixtures/images/image.jpg';

module.exports = config;

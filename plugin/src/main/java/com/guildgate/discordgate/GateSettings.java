package com.guildgate.discordgate;

import java.net.URI;
import java.time.Duration;

record GateSettings(URI baseUri, String apiKey, Duration connectTimeout, Duration requestTimeout) {
    static GateSettings invalid() {
        return new GateSettings(null, "", Duration.ofSeconds(1), Duration.ofSeconds(1));
    }

    boolean isUsable() {
        return baseUri != null && !apiKey.isBlank() && !"CHANGE_ME".equals(apiKey);
    }

    URI checkEndpoint() {
        if (baseUri == null) {
            throw new IllegalStateException("API設定が無効です");
        }
        String basePath = baseUri.getPath() == null ? "" : baseUri.getPath().replaceAll("/+$", "");
        return baseUri.resolve(basePath + "/api/v1/check");
    }
}

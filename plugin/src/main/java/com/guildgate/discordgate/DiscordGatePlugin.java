package com.guildgate.discordgate;

import java.net.URI;
import java.time.Duration;
import java.util.Objects;
import java.util.logging.Logger;
import org.bukkit.plugin.java.JavaPlugin;

/** Entrypoint for the Discord membership login gate. */
public final class DiscordGatePlugin extends JavaPlugin {
    private static final int MIN_TIMEOUT_SECONDS = 1;
    private static final int MAX_TIMEOUT_SECONDS = 30;

    private GateSettings settings;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        try {
            this.settings = loadSettings();
        } catch (IllegalArgumentException exception) {
            getLogger().severe("DiscordGate の設定が不正です。安全のため全ての接続を拒否します: " + exception.getMessage());
            this.settings = GateSettings.invalid();
        }
        getServer().getPluginManager().registerEvents(new LoginListener(settings, getLogger()), this);
    }

    private GateSettings loadSettings() {
        String rawBaseUrl = Objects.requireNonNull(getConfig().getString("api-base-url"), "api-base-url がありません").trim();
        String apiKey = Objects.requireNonNull(getConfig().getString("api-key"), "api-key がありません").trim();
        int connectTimeout = clampTimeout(getConfig().getInt("connect-timeout-seconds", 3));
        int requestTimeout = clampTimeout(getConfig().getInt("request-timeout-seconds", 5));

        if (rawBaseUrl.isEmpty()) {
            throw new IllegalArgumentException("api-base-url は空にできません");
        }
        URI baseUri;
        try {
            baseUri = URI.create(rawBaseUrl);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("api-base-url は有効なHTTPS URLではありません");
        }
        if (!"https".equalsIgnoreCase(baseUri.getScheme()) || baseUri.getHost() == null
                || baseUri.getRawUserInfo() != null || baseUri.getRawQuery() != null || baseUri.getRawFragment() != null) {
            throw new IllegalArgumentException("api-base-url はクエリ・フラグメントなしのHTTPS URLである必要があります");
        }
        if (apiKey.isEmpty() || "CHANGE_ME".equals(apiKey)) {
            getLogger().warning("api-key が未設定です。安全のため全ての接続を拒否します。");
        }
        return new GateSettings(baseUri, apiKey, Duration.ofSeconds(connectTimeout), Duration.ofSeconds(requestTimeout));
    }

    private int clampTimeout(int seconds) {
        if (seconds < MIN_TIMEOUT_SECONDS || seconds > MAX_TIMEOUT_SECONDS) {
            getLogger().warning("タイムアウトは " + MIN_TIMEOUT_SECONDS + "〜" + MAX_TIMEOUT_SECONDS + " 秒に制限されます。");
        }
        return Math.clamp(seconds, MIN_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS);
    }
}

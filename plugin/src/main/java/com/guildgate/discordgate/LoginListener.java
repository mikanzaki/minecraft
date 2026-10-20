package com.guildgate.discordgate;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerPreLoginEvent;

/** Calls the Web API only from Paper's asynchronous pre-login event. */
final class LoginListener implements Listener {
    private static final int MAX_RESPONSE_BYTES = 16 * 1024;
    private static final Component TEMPORARY_FAILURE = Component.text("認証状態を一時的に確認できませんでした。しばらくしてから再接続してください。", NamedTextColor.RED);
    private static final Component GUILD_REQUIRED = Component.text("Discordサーバーへの参加が必要です。対象のDiscordサーバーに参加してから、再接続してください。", NamedTextColor.RED);

    private final GateSettings settings;
    private final Logger logger;
    private final HttpClient client;

    LoginListener(GateSettings settings, Logger logger) {
        this.settings = settings;
        this.logger = logger;
        this.client = HttpClient.newBuilder()
                .connectTimeout(settings.connectTimeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .version(HttpClient.Version.HTTP_2)
                .build();
    }

    @EventHandler(priority = EventPriority.HIGHEST)
    public void onAsyncPreLogin(AsyncPlayerPreLoginEvent event) {
        if (!settings.isUsable()) {
            event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER, TEMPORARY_FAILURE);
            return;
        }

        try {
            ApiDecision decision = check(event.getUniqueId(), event.getName());
            switch (decision.status()) {
                case ALLOW -> {
                    // Allowing is the default. Do not overwrite another plugin's decision.
                }
                case LINK_REQUIRED -> event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER, linkRequiredMessage(decision.url(), decision.code()));
                case GUILD_REQUIRED -> event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER, GUILD_REQUIRED);
                case TEMPORARY_FAILURE -> event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER, TEMPORARY_FAILURE);
            }
        } catch (IOException | InterruptedException | RuntimeException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            // Never include the API key or full HTTP body in logs.
            logger.log(Level.WARNING, "Discord認証APIの検証に失敗しました: " + exception.getClass().getSimpleName());
            event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER, TEMPORARY_FAILURE);
        }
    }

    private ApiDecision check(UUID uuid, String username) throws IOException, InterruptedException {
        String requestJson = "{\"uuid\":\"" + uuid + "\",\"username\":\"" + escapeJson(username) + "\"}";
        HttpRequest request = HttpRequest.newBuilder(settings.checkEndpoint())
                .timeout(settings.requestTimeout())
                .header("Authorization", "Bearer " + settings.apiKey())
                .header("Content-Type", "application/json; charset=utf-8")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestJson, StandardCharsets.UTF_8))
                .build();

        HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() != 200
                || response.headers().firstValueAsLong("Content-Length").orElse(0L) > MAX_RESPONSE_BYTES) {
            response.body().close();
            return ApiDecision.temporaryFailure();
        }
        try (InputStream body = response.body()) {
            byte[] responseBytes = body.readNBytes(MAX_RESPONSE_BYTES + 1);
            if (responseBytes.length > MAX_RESPONSE_BYTES) {
                return ApiDecision.temporaryFailure();
            }
            return parseDecision(new String(responseBytes, StandardCharsets.UTF_8));
        }
    }

    private ApiDecision parseDecision(String json) {
        JsonElement root = JsonParser.parseString(json);
        if (!root.isJsonObject()) {
            return ApiDecision.temporaryFailure();
        }
        JsonObject object = root.getAsJsonObject();
        JsonElement statusElement = object.get("status");
        if (statusElement == null || !statusElement.isJsonPrimitive() || !statusElement.getAsJsonPrimitive().isString()) {
            return ApiDecision.temporaryFailure();
        }

        return switch (statusElement.getAsString()) {
            case "ALLOW" -> ApiDecision.allow();
            case "GUILD_REQUIRED" -> ApiDecision.guildRequired();
            case "LINK_REQUIRED" -> parseLinkRequired(object);
            // TEMPORARY_ERROR and all unknown response values fail closed.
            default -> ApiDecision.temporaryFailure();
        };
    }

    private ApiDecision parseLinkRequired(JsonObject object) {
        JsonElement urlElement = object.get("url");
        JsonElement codeElement = object.get("code");
        if (urlElement == null || !urlElement.isJsonPrimitive() || !urlElement.getAsJsonPrimitive().isString()) {
            return ApiDecision.temporaryFailure();
        }
        if (codeElement == null || !codeElement.isJsonPrimitive() || !codeElement.getAsJsonPrimitive().isString()) {
            return ApiDecision.temporaryFailure();
        }
        String rawUrl = urlElement.getAsString();
        String code = codeElement.getAsString();
        try {
            URI uri = URI.create(rawUrl);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || rawUrl.length() > 2048
                    || !code.matches("\\d{6}")) {
                return ApiDecision.temporaryFailure();
            }
            return ApiDecision.linkRequired(uri.toString(), code);
        } catch (IllegalArgumentException exception) {
            return ApiDecision.temporaryFailure();
        }
    }

    private Component linkRequiredMessage(String url, String code) {
        URI target = URI.create(url);
        String displayUrl = target.getScheme() + "://" + target.getRawAuthority() + "/";
        String groupedCode = code.substring(0, 3) + " " + code.substring(3);
        return Component.text("Discord認証が必要です。\nブラウザーでURLを開き、次の6桁コードを入力してください。\n", NamedTextColor.RED)
                .append(Component.text(displayUrl + "\n", NamedTextColor.AQUA))
                .append(Component.text("認証コード: " + groupedCode + "\n", NamedTextColor.YELLOW))
                .append(Component.text("コードは15分有効です。認証後にMinecraftへ再接続してください。", NamedTextColor.GRAY));
    }

    private static String escapeJson(String value) {
        StringBuilder escaped = new StringBuilder(value.length() + 8);
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            switch (character) {
                case '"' -> escaped.append("\\\"");
                case '\\' -> escaped.append("\\\\");
                case '\b' -> escaped.append("\\b");
                case '\f' -> escaped.append("\\f");
                case '\n' -> escaped.append("\\n");
                case '\r' -> escaped.append("\\r");
                case '\t' -> escaped.append("\\t");
                default -> {
                    if (character < 0x20) {
                        escaped.append(String.format("\\u%04x", (int) character));
                    } else {
                        escaped.append(character);
                    }
                }
            }
        }
        return escaped.toString();
    }

    private enum DecisionStatus { ALLOW, LINK_REQUIRED, GUILD_REQUIRED, TEMPORARY_FAILURE }

    private record ApiDecision(DecisionStatus status, String url, String code) {
        static ApiDecision allow() { return new ApiDecision(DecisionStatus.ALLOW, null, null); }
        static ApiDecision linkRequired(String url, String code) { return new ApiDecision(DecisionStatus.LINK_REQUIRED, url, code); }
        static ApiDecision guildRequired() { return new ApiDecision(DecisionStatus.GUILD_REQUIRED, null, null); }
        static ApiDecision temporaryFailure() { return new ApiDecision(DecisionStatus.TEMPORARY_FAILURE, null, null); }
    }
}

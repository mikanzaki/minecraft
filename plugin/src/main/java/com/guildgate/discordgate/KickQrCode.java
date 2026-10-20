package com.guildgate.discordgate;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import java.util.EnumMap;
import java.util.Map;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextColor;

/** Renders a QR code as Unicode quadrant blocks for Minecraft's dark disconnect screen. */
final class KickQrCode {
    private static final TextColor BLACK = TextColor.color(0x000000);
    private static final TextColor WHITE = TextColor.color(0xFFFFFF);

    private KickQrCode() {}

    static Component render(String content) throws WriterException {
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
        hints.put(EncodeHintType.MARGIN, 4);
        BitMatrix matrix = new QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, 1, 1, hints);

        Component image = Component.empty();
        int rows = (matrix.getHeight() + 1) / 2;
        int columns = (matrix.getWidth() + 1) / 2;
        for (int row = 0; row < rows; row++) {
            Component line = Component.empty();
            for (int column = 0; column < columns; column++) {
                int x = column * 2;
                int y = row * 2;
                int darkPattern = 0;
                if (matrix.get(x, y)) darkPattern |= 1;
                if (x + 1 < matrix.getWidth() && matrix.get(x + 1, y)) darkPattern |= 2;
                if (y + 1 < matrix.getHeight() && matrix.get(x, y + 1)) darkPattern |= 4;
                if (x + 1 < matrix.getWidth() && y + 1 < matrix.getHeight() && matrix.get(x + 1, y + 1)) darkPattern |= 8;

                int whitePattern = darkPattern ^ 0x0F;
                TextColor foreground = whitePattern == 0 ? BLACK : WHITE;
                line = line.append(Component.text(String.valueOf(glyph(whitePattern)), foreground));
            }
            image = image.append(line);
            if (row + 1 < rows) image = image.append(Component.text("\n"));
        }
        return image;
    }

    private static char glyph(int whitePattern) {
        return switch (whitePattern) {
            case 1 -> '\u2598'; // top left
            case 2 -> '\u259D'; // top right
            case 3 -> '\u2580'; // top half
            case 4 -> '\u2596'; // bottom left
            case 5 -> '\u258C'; // left half
            case 6 -> '\u259E'; // top right + bottom left
            case 7 -> '\u259B'; // all except bottom right
            case 8 -> '\u2597'; // bottom right
            case 9 -> '\u259A'; // top left + bottom right
            case 10 -> '\u2590'; // right half
            case 11 -> '\u259C'; // all except bottom left
            case 12 -> '\u2584'; // bottom half
            case 13 -> '\u2599'; // all except top right
            case 14 -> '\u259F'; // all except top left
            case 15 -> '\u2588'; // full white block
            default -> '\u2588'; // full dark block when foreground is black
        };
    }
}

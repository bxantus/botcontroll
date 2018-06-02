package com.drx.trash.botcontroll;

import android.content.Context;

import java.io.*;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * @author Botond Xantus
 */
public class BotLog {
    private static final String fileName = "switchbot.log";

    public static void addLine(Context ctx, String s) {
        try {
            FileOutputStream outputStream = ctx.openFileOutput(fileName, Context.MODE_APPEND);
            DataOutputStream outs = new DataOutputStream(outputStream);
            String time = new SimpleDateFormat("MM-dd hh:mm").format(new Date());

            outs.writeChars(String.format("%s %s\n", time, s));

            outs.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static List<String> getContents(Context ctx) {
        ArrayList<String> result = new ArrayList<>();
        try {
            FileInputStream inputStream = ctx.openFileInput(fileName);
            BufferedReader br = new BufferedReader(new InputStreamReader(inputStream));
            String line;
            while ((line = br.readLine()) != null) {
                result.add(line);
            }
        }
        catch (FileNotFoundException e) {}
        catch (IOException e) {}

        return result;
    }
}

package com.drx.trash.botcontroll.services;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.support.annotation.Nullable;
import com.drx.trash.botcontroll.BotController;
import com.drx.trash.botcontroll.BotLog;
import com.drx.trash.botcontroll.R;
import com.drx.trash.botcontroll.SwitchBot;
import com.drx.trash.botcontroll.ui.DeviceScanActivity;

/**
 * @author Botond Xantus
 */
public class HandlePressService extends Service {
    public static final String EXTRA_ADDRESS = "device-address";
    public static final String EXTRA_NAME = "device-name";
    public static final int ONGOING_NOTIFICATION_ID = 1;

    @Override
    public int onStartCommand(Intent intent, int flags, final int startId) {
        if (!inForeground) {
            Intent notificationIntent = new Intent(this, DeviceScanActivity.class);
            PendingIntent pendingIntent =
                    PendingIntent.getActivity(this, 0, notificationIntent, 0);

            Notification notification =
                    new Notification.Builder(this)
                            .setContentTitle("BotControll")
                            .setContentText("Timers are running")
                            .setSmallIcon(R.drawable.ic_launcher)
                            .setContentIntent(pendingIntent)
                            .setShowWhen(false)
                            .build();

            startForeground(ONGOING_NOTIFICATION_ID, notification);
            inForeground = true;
        }

        if (intent != null && intent.getExtras() != null) {
            String address = intent.getExtras().getString(EXTRA_ADDRESS, null);
            String name = intent.getExtras().getString(EXTRA_NAME);

            if (address != null) {
                SwitchBot bot = new SwitchBot(address, name);
                BotController controller = BotController.createController(this, bot, new BotController.IComnmandCompleted() {
                    @Override
                    public void onCommandCompleted(boolean success) {
                        BotLog.addLine(HandlePressService.this, String.format("PressService finished. success: %b", success));
                    }
                });
                if (controller != null) {
                    BotLog.addLine(this, "PressService activated: start press");
                    controller.press();
                } else {
                    BotLog.addLine(this, "PressService activated ERROR. can't press");
                }
            }
        }
        return Service.START_NOT_STICKY;
    }

    boolean inForeground = false;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {  return null;}


}

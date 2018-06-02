package com.drx.trash.botcontroll.services;

import android.app.job.JobParameters;
import android.app.job.JobService;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.content.Context;
import android.os.PersistableBundle;
import android.util.Log;
import com.drx.trash.botcontroll.BotController;
import com.drx.trash.botcontroll.SwitchBot;

/**
 * @author Botond Xantus
 */
public class ScheduleService extends JobService implements BotController.IComnmandCompleted {
    public static final String EXTRA_ADDRESS = "device-address";
    public static final String EXTRA_NAME = "device-name";
    private final static String TAG = ScheduleService.class.getSimpleName();

    private JobParameters runningJob;

    @Override
    public boolean onStartJob(JobParameters jobParameters) {
        BluetoothManager btManager = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        if (btManager == null) {
            Log.e(TAG, "Unable to initialize BluetoothManager.");
            return false; // completed job
        }

        BluetoothAdapter btAdapter = btManager.getAdapter();
        if (btAdapter == null) {
            Log.e(TAG, "Unable to obtain a BluetoothAdapter.");
            return false;
        }

        PersistableBundle extras = jobParameters.getExtras();
        String address = extras.getString(EXTRA_ADDRESS);
        String name = extras.getString(EXTRA_NAME);

        Log.i(TAG, String.format("Executing press Job for '%s'", name));

        SwitchBot bot = new SwitchBot(address, name);
        BotController controller = new BotController(this, btAdapter, bot, this);
        controller.press(); // TODO: notify after controller completed job

        runningJob = jobParameters;

        return true; // wait for finnish
    }

    @Override
    public boolean onStopJob(JobParameters jobParameters) {
        return false;
    }

    @Override
    public void onCommandCompleted(boolean success) {
        if (runningJob != null) {
            jobFinished(runningJob, false);
            runningJob = null;
            Log.i(TAG, "Job finished! ");
        }
    }
}

/*
 * Copyright (C) 2013 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.drx.trash.botcontroll.ui;

import android.app.Activity;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.bluetooth.BluetoothGattCharacteristic;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.PersistableBundle;
import android.util.Log;
import android.view.MenuItem;
import android.view.View;
import android.widget.*;
import com.drx.trash.botcontroll.BotController;
import com.drx.trash.botcontroll.BotLog;
import com.drx.trash.botcontroll.SwitchBot;
import com.drx.trash.botcontroll.services.ScheduleService;
import com.drx.trash.botcontroll.R;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class DeviceSetupActivity extends Activity {
    private final static String TAG = DeviceSetupActivity.class.getSimpleName();

    public static final String EXTRAS_DEVICE_NAME = "DEVICE_NAME";
    public static final String EXTRAS_DEVICE_ADDRESS = "DEVICE_ADDRESS";

    private String mDeviceName;
    private String mDeviceAddress;
    private ListView mLogList;
    private ArrayList<ArrayList<BluetoothGattCharacteristic>> mGattCharacteristics =
            new ArrayList<ArrayList<BluetoothGattCharacteristic>>();

    private final String LIST_NAME = "NAME";
    private final String LIST_UUID = "UUID";



    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.device_setup);

        final Intent intent = getIntent();
        mDeviceName = intent.getStringExtra(EXTRAS_DEVICE_NAME);
        mDeviceAddress = intent.getStringExtra(EXTRAS_DEVICE_ADDRESS);

        // Sets up UI references.
        ((TextView) findViewById(R.id.device_address)).setText(mDeviceAddress);
        mLogList = (ListView) findViewById(R.id.log_list);

        final SwitchBot bot = new SwitchBot(mDeviceAddress, mDeviceName);
        Button btnPress = (Button)findViewById(R.id.setup_press);
        btnPress.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                BotController controller = BotController.createController( DeviceSetupActivity.this, bot, null);
                if (controller != null)
                    controller.press();
            }
        });

        Button btnRefresh = (Button)findViewById(R.id.setup_refresh_log);
        btnRefresh.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                updateLog(BotLog.getContents(DeviceSetupActivity.this));
            }
        });

        getActionBar().setTitle(mDeviceName);
        getActionBar().setDisplayHomeAsUpEnabled(true);

        CheckBox chkTimersEnabled = (CheckBox)findViewById(R.id.setup_enable_timers);
        chkTimersEnabled.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton compoundButton, boolean checked) {
                if (checked) { // reschedule job
                    scheduleJobs();
                } else { // cancel jobs
                    cancelJobs();
                }
            }
        });

        // schedule job
        if (chkTimersEnabled.isChecked())
            scheduleJobs();
    }

    private void scheduleJobs() {
        Log.i(TAG, "scheduling jobs...");
        ComponentName scheduleService = new ComponentName(this, ScheduleService.class);
        JobInfo.Builder builder = new JobInfo.Builder(0, scheduleService);
        builder.setPeriodic(5 * 60 * 1000); // job scheduled for 10 minutes

        PersistableBundle extras = new PersistableBundle();
        extras.putString(ScheduleService.EXTRA_ADDRESS, mDeviceAddress);
        extras.putString(ScheduleService.EXTRA_NAME, mDeviceName);
        builder.setExtras(extras);

        JobScheduler tm = (JobScheduler) getSystemService(Context.JOB_SCHEDULER_SERVICE);
        tm.schedule(builder.build());
    }

    private void cancelJobs() {
        Log.i(TAG, "stopping jobs...");
        JobScheduler tm = (JobScheduler) getSystemService(Context.JOB_SCHEDULER_SERVICE);
        tm.cancelAll();
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateLog(BotLog.getContents(this));
    }

    @Override
    protected void onPause() {
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
    }


    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        switch(item.getItemId()) {
            case R.id.menu_connect:
                return true;
            case R.id.menu_disconnect:
                return true;
            case android.R.id.home:
                onBackPressed();
                return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void updateLog(List<String> logLines) {
        Collections.reverse(logLines);
        mLogList.setAdapter(new ArrayAdapter<>(this,  android.R.layout.simple_list_item_1, logLines));
    }

}

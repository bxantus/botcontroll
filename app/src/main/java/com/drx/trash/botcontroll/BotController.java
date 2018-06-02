package com.drx.trash.botcontroll;

import android.bluetooth.*;
import android.content.Context;
import android.util.Log;

import java.util.List;
import java.util.UUID;
import android.os.Handler;
import java.util.logging.LogRecord;

/**
 * @author Botond Xantus
 */
public class BotController {
    private final static String TAG = BotController.class.getSimpleName();

    public interface IComnmandCompleted {
        void onCommandCompleted(boolean success);
    }

    public static BotController createController(Context ctx, SwitchBot bot, IComnmandCompleted completedCallback) {
        BluetoothManager btManager = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        if (btManager == null) {
            Log.e(TAG, "Unable to initialize BluetoothManager.");
            return null;
        }

        BluetoothAdapter btAdapter = btManager.getAdapter();
        if (btAdapter == null) {
            Log.e(TAG, "Unable to obtain a BluetoothAdapter.");
            return null;
        }

        return new BotController(ctx, btAdapter, bot, completedCallback);
    }

    public BotController(Context ctx, BluetoothAdapter btAdapter, SwitchBot bot, IComnmandCompleted completedCallback) {
        this.bot = bot;
        device = btAdapter.getRemoteDevice(bot.address);
        this.ctx = ctx;
        handler = new Handler();
        this.completedCallback = completedCallback;
    }

    public void press() {
        scheduleCommand(Command.Press);
    }

    public void turnOn() {
        scheduleCommand(Command.TurnOn);
    }

    public void turnOff() {
        scheduleCommand(Command.TurnOff);
    }

    private BluetoothDevice device;
    private BluetoothGatt btGatt;
    private SwitchBot bot;
    BluetoothGattCharacteristic switchCharacteristic;
    Command scheduledCommand = null;
    Context ctx;
    ConnectionState connectionState = ConnectionState.Disconnected;
    Handler handler;
    IComnmandCompleted completedCallback;
    static final UUID switchCharacteristicId = UUID.fromString("cba20002-224d-11e6-9fb8-0002a5d5c51b");


    enum Command {
        Press(new byte[]{0x57, 0x01, 0x00}),
        TurnOn(new byte[]{0x57, 0x01, 0x01}),
        TurnOff(new byte[]{0x57, 0x01, 0x02});

        public byte [] data;
        Command(byte[] data) {
            this.data = data;
        }
    }

    enum ConnectionState {
        Connecting,
        Connected,
        Disconnected
    }

    private void connect() {
        if (device != null && btGatt == null) {
            btGatt = device.connectGatt(ctx, false, new BluetoothGattCallback() {
                @Override
                public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
                    Log.i(TAG, String.format("ConnectionStateChange to '%s', state: %d", bot.name, newState));
                    if (newState == BluetoothProfile.STATE_CONNECTED) {
                        connectionState = ConnectionState.Connected;
                        if (switchCharacteristic == null) {
                            gatt.discoverServices();
                        } else {
                            executeCommand(scheduledCommand);
                        }
                    } else if(newState == BluetoothProfile.STATE_DISCONNECTED) {
                        connectionState = ConnectionState.Disconnected;
                        if (scheduledCommand != null) {
                            triggerCallback(false);
                        }
                    }
                }

                @Override
                public void onServicesDiscovered(BluetoothGatt gatt, int status) {
                    Log.i(TAG, String.format("Discovered services of '%s'", bot.name));
                    if (status == BluetoothGatt.GATT_SUCCESS && switchCharacteristic == null) {

                        List<BluetoothGattService> services = gatt.getServices();

                        for (BluetoothGattService s : services) {
                            switchCharacteristic = s.getCharacteristic(switchCharacteristicId);
                            if (switchCharacteristic != null) break;
                        }

                        if (switchCharacteristic != null) {
                            Log.i(TAG, String.format("Got switchcharacteristic of '%s'", bot.name));
                            executeCommand(scheduledCommand);
                        } else {
                            triggerCallback(false);
                        }
                    }

                }

                @Override
                public void onCharacteristicWrite(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, int status) {
                    Log.i(TAG, String.format("Command to '%s', status: %d", bot.name, status));
                    scheduledCommand = null;
                    BotLog.addLine(ctx, String.format("BotController: Press sent to '%s', status: %d", bot.name, status));

                    // disconnect in 3 seconds
                    handler.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                           // notify success if needed
                           triggerCallback(true);
                           Log.i(TAG, "Disconnecting...");
                           btGatt.disconnect();
                        }
                    }, 3000);

                }
            });
        } else {
            btGatt.connect();
        }
        connectionState = ConnectionState.Connecting;
    }

    private void scheduleCommand(Command command) {
        scheduledCommand = command;

        if (connectionState == ConnectionState.Connected) {
            // can be run directly
            executeCommand(command);
        } else if (connectionState == ConnectionState.Disconnected) {
            connect(); // callbacks will handle the command
        }

    }

    // should be in connected state and switch characteristic should be available
    private void executeCommand(Command command) {
        if (command != null) {
            switchCharacteristic.setValue(command.data);
            btGatt.writeCharacteristic(switchCharacteristic);
            Log.i(TAG, String.format("Sent command to '%s'", bot.name));
        }
    }

    private void triggerCallback(boolean success) {
        if (completedCallback != null) {
            completedCallback.onCommandCompleted(success);
            completedCallback = null;
        }
    }
}

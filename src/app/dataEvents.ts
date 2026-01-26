import { DeviceEventEmitter, EmitterSubscription } from "react-native";

const DATA_RESET_EVENT = "dataReset";

export const emitDataReset = (): void => {
  DeviceEventEmitter.emit(DATA_RESET_EVENT);
};

export const onDataReset = (handler: () => void): EmitterSubscription =>
  DeviceEventEmitter.addListener(DATA_RESET_EVENT, handler);

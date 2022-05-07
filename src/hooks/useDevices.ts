import { useImmer } from 'use-immer';
import { ZegoDeviceInfo } from 'zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.web';
import { useCallback, useState } from 'react';
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';

/**
 * 枚举并检测设备权限
 * @param zg
 * @returns
 */
const useDevices = (zg: ZegoExpressEngine | null) => {
  // 设备列表
  const [device, setDevice] = useImmer<{
    audioDeviceList: ZegoDeviceInfo[];
    videoDeviceList: ZegoDeviceInfo[];
    microphoneDevicesVal: string;
    cameraDevicesVal: string;
  }>({
    audioDeviceList: [],
    videoDeviceList: [],
    microphoneDevicesVal: '',
    cameraDevicesVal: '',
  });
  /**
   * 枚举音/视频设备
   */
  const enumerateDevices = useCallback(async () => {
    const deviceInfo = await zg?.enumDevices();
    const audioDeviceList =
      deviceInfo &&
      deviceInfo.microphones.map((item, index) => {
        if (!item.deviceName) {
          item.deviceName = 'microphone' + index;
        }
        console.log('microphone: ' + item.deviceName);
        return item;
      });
    audioDeviceList?.push({ deviceID: '0', deviceName: '禁止' });
    const videoDeviceList =
      deviceInfo &&
      deviceInfo.cameras.map((item, index) => {
        if (!item.deviceName) {
          item.deviceName = 'camera' + index;
        }
        console.log('camera: ' + item.deviceName);
        return item;
      });
    videoDeviceList?.push({ deviceID: '0', deviceName: '禁止' });
    setDevice((d) => {
      d.audioDeviceList = audioDeviceList ?? [];
      d.videoDeviceList = videoDeviceList ?? [];
      d.microphoneDevicesVal = audioDeviceList?.[0].deviceID ?? '';
      d.cameraDevicesVal = videoDeviceList?.[0].deviceID ?? '';
    });
  }, [setDevice, zg]);

  // 设备权限状态
  const [deviceStatus, setDeviceStatus] = useState<{
    [key: string]: boolean;
    camera: boolean;
    microphone: boolean;
  }>({
    camera: false,
    microphone: false,
  });
  /**
   * 检查当前设备权限状态并枚举设备
   */
  const checkSystemRequirements = useCallback(async () => {
    console.warn('sdk version is', zg?.getVersion());
    try {
      const result = await zg?.checkSystemRequirements();

      console.warn('checkSystemRequirements ', result);

      if (!result?.webRTC) {
        console.error('browser is not support webrtc!!');
        return false;
      } else if (!result.videoCodec?.H264 && !result.videoCodec?.VP8) {
        console.error('browser is not support H264 and VP8');
        return false;
      } else if (!result.camera && !result.microphone) {
        console.error('camera and microphones not allowed to use');
        setDeviceStatus({
          camera: false,
          microphone: false,
        });
        return false;
      } else if (result.videoCodec.VP8) {
        if (!result.screenSharing)
          console.warn('browser is not support screenSharing');
      } else {
        console.log('不支持VP8，请前往混流转码测试');
      }
      setDeviceStatus({
        camera: true,
        microphone: true,
      });
      await enumerateDevices();
      return true;
    } catch (err) {
      console.error('checkSystemRequirements', err);
      return false;
    }
  }, [enumerateDevices, zg]);

  return {
    device,
    deviceStatus,
    checkSystemRequirements,
  };
};

export default useDevices;

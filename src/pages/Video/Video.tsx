import cn from 'classnames';
import { useEffect, useMemo, useState } from 'react';
import { ReactComponent as MicroPhone } from 'assets/video/microphone.svg';
import { ReactComponent as Camera } from 'assets/video/camera.svg';
import { ReactComponent as HangUp } from 'assets/video/hangup.svg';
import { Button, Popover } from '@nextui-org/react';
import { useImmer } from 'use-immer';
import Draggable from 'react-draggable';
import useZego, { RoomState } from 'hooks/useZego';
import useZim from 'hooks/useZim';
import MessageCard from 'components/MessageCard';

const appID = 1237665297;
const server = 'wss://webliveroom1237665297-api.imzego.com/ws';
const serverSecret = '8f6359ee682a3ca977dd3b001e97faec';

const deviceValid: {
  [key: string]: string;
} = {
  camera: '摄像机',
  microphone: '麦克风',
};

type Props = {
  type?: 'server' | 'client';
};

const Server = ({ type = 'server' }: Props) => {
  // 房间信息
  const [roomState, setRoomState] = useImmer<RoomState>({
    roomId: '',
    userId: '',
    userName: '',
    token: '',
  });
  const validType = useMemo(
    () => ({
      server: () =>
        setRoomState((d) => {
          d.userId = process.env.REACT_APP_userId1 ?? '';
          d.roomId = process.env.REACT_APP_roomId1 ?? '';
          d.userName = process.env.REACT_APP_userName1 ?? '';
          d.token = process.env.REACT_APP_token1 ?? '';
        }),
      client: () =>
        setRoomState((d) => {
          d.userId = process.env.REACT_APP_userId2 ?? '';
          d.roomId = process.env.REACT_APP_roomId2 ?? '';
          d.userName = process.env.REACT_APP_userName2 ?? '';
          d.token = process.env.REACT_APP_token2 ?? '';
        }),
    }),
    [setRoomState]
  );
  // 模拟销售人员
  useEffect(() => {
    validType[type]();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRoomState]);

  // 音/视频
  const {
    handleVideo,
    showVideo,
    isPublishing,
    playVideoRef,
    publishVideoRef,
    loading,
    deviceStatus,
    hangUp,
  } = useZego(appID, server, roomState);

  // 即时通讯
  const { sendMsg, toSendMsg } = useZim(
    appID,
    serverSecret,
    roomState,
    type === 'server'
  );
  // 输入框内容
  const [msg, setMsg] = useState('');

  const handleSend = () => {
    toSendMsg(msg);
    setMsg('');
  };
  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (
    e
  ) => {
    if (e.key === 'Enter') e.preventDefault();
    if (e.key === 'Enter' && e.ctrlKey) {
      setMsg(msg + '\n');
    }
  };
  const handleKey: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.ctrlKey) {
      handleSend();
    }
  };

  return (
    <>
      <div
        className={cn(
          'top-0 left-0 w-full h-full',
          'fixed md:top-1/2 md:left-1/2 rounded-md shadow-md',
          'md:transform md:-translate-x-1/2 md:-translate-y-1/2',
          'p-4 md:w-[800px] md:h-[unset]'
        )}
      >
        {/* 标头 */}
        <div className="flex justify-between py-4">
          <div className="flex items-center">
            <span className="mr-2 text-2xl font-medium">
              云汇展在线工作人员
            </span>
            {/* <span
              className={cn(
                'w-4 h-4 rounded-full',
                isOnline ? 'bg-green-600' : 'bg-red-600'
              )}
            ></span> */}
          </div>
          <div
            className={cn(
              'rounded bg-red-500 font-bold w-[32px]',
              'text-white text-2xl',
              'flex justify-center items-center',
              'cursor-pointer'
            )}
          >
            X
          </div>
        </div>
        <div className="h-[1px] bg-gray-300"></div>

        {/* 聊天内容框 */}
        <div className="h-[400px] overflow-y-auto">
          {sendMsg.map((m) => {
            return (
              <MessageCard
                key={m.timestamp}
                username={roomState.userName}
                msg={m.message}
                isSelf={m.userID === roomState.userId}
              />
            );
          })}
        </div>

        <div className="h-[1px] bg-gray-300"></div>
        {/* 聊天工具栏 */}
        <div className="flex items-center p-4">
          <Popover placement="top">
            <Popover.Trigger>
              <Camera className="mr-4 cursor-pointer" onClick={handleVideo} />
            </Popover.Trigger>
            {/* {isOnline ? (
              <></>
            ) : (
              <Popover.Content>
                <div className="p-4">对方不在线</div>
              </Popover.Content>
            )} */}
          </Popover>

          <MicroPhone className="cursor-pointer " />
        </div>

        {/* 聊天内容输入框 */}
        <div className="h-[120px] p-2">
          <textarea
            name=""
            id=""
            className="w-full h-full resize-none"
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKey}
            value={msg}
          ></textarea>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSend}>发送</Button>
        </div>
      </div>

      {showVideo && (
        <Draggable>
          <div
            className={cn(
              'fixed z-10 cursor-move ',
              'flex justify-center items-center',
              'bg-white rounded-lg shadow-lg',
              'group overflow-hidden',
              'w-full h-full',
              'md:w-[640px] md:h-[480px]'
            )}
          >
            {/* 拉流 对方的视频流 */}
            <video
              className={cn(
                'rounded-lg ',
                isPublishing || 'hidden',
                'w-full h-full',
                'md:w-[640px] md:h-[480px]'
              )}
              ref={playVideoRef}
              autoPlay
            ></video>
            {/* 推流 本机的视频流 */}
            <video
              className={cn(
                'rounded-lg w-[240px] h-[180px]',
                isPublishing || 'hidden',
                'absolute right-4 bottom-4'
              )}
              ref={publishVideoRef}
              autoPlay
            ></video>

            <div className={cn(isPublishing && 'hidden')}>
              {loading ? (
                <div>检测设备中</div>
              ) : (
                Object.keys(deviceStatus).map((k) => (
                  <div key={k} className="flex">
                    {deviceValid[k]}：
                    {deviceStatus[k] ? (
                      <div className="flex items-center">
                        <div className="w-3 h-3 mr-1 bg-green-600 rounded-full"></div>
                        <div>权限正常</div>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <div className="w-3 h-3 mr-1 bg-red-600 rounded-full"></div>
                        <div>无法读取{deviceValid[k]}</div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* 视频控制栏 */}
            <div
              className={cn(
                'absolute hidden',
                'group-hover:flex',
                'transition-all',
                'h-[100px] w-full',
                'items-center justify-evenly',
                'bottom-0',
                'bg-opacity-50 bg-gray-300'
              )}
            >
              <div className="cursor-pointer" onClick={hangUp}>
                <HangUp className="w-12 h-12" />
              </div>
            </div>
          </div>
        </Draggable>
      )}
    </>
  );
};

export default Server;

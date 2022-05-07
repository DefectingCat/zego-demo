import { AES, enc } from 'crypto-js';
import { useCallback, useEffect, useState } from 'react';
import { useImmer } from 'use-immer';
import { ZIM, ZIMMessage } from 'zego-zim-web';
import { RoomState } from './useZego';

/**
 * 生成 token
 *
 * Token = “04” + Base64.encode(expire_time + IV.length + IV + 二进制密文.length + 二进制密文)
 * 算法：AES<ServerSecret, IV>(token_json_str)，使用模式: CBC/PKCS5Padding
 *
 * 这里仅提供生成 token 的客户端示例代码。请务必在您的业务后台生成 Token，避免泄漏您的 ServerSecret
 */
function generateToken(
  userID: string,
  appID: number,
  serverSecret: string,
  seconds?: number
) {
  if (!userID) return '';

  // 构造 加密数据
  const time = (Date.now() / 1000) | 0;
  const body = {
    app_id: appID,
    user_id: userID,
    nonce: (Math.random() * 2147483647) | 0,
    ctime: time,
    expire: time + (seconds || 7200),
  };
  // 加密 body
  const key = enc.Utf8.parse(serverSecret);
  let iv = Math.random().toString().substring(2, 17);
  if (iv.length < 16) iv += iv.substring(0, 17 - iv.length);

  const ciphertext = AES.encrypt(JSON.stringify(body), key, {
    iv: enc.Utf8.parse(iv),
  }).toString();
  const ciphert = Uint8Array.from(
    Array.from(atob(ciphertext)).map((val) => val.charCodeAt(0))
  );
  const len_ciphert = ciphert.length;

  // 组装 token 数据
  const uint8 = new Uint8Array(8 + 2 + 16 + 2 + len_ciphert);
  // expire: 8
  uint8.set([0, 0, 0, 0]);
  uint8.set(new Uint8Array(Int32Array.from([body.expire]).buffer).reverse(), 4);
  // iv length: 2
  uint8[8] = 16 >> 8;
  uint8[9] = 16 - (uint8[8] << 8);
  // iv: 16
  uint8.set(
    Uint8Array.from(Array.from(iv).map((val) => val.charCodeAt(0))),
    10
  );
  // 密文 length: 2
  uint8[26] = len_ciphert >> 8;
  uint8[27] = len_ciphert - (uint8[26] << 8);
  // 密文
  uint8.set(ciphert, 28);

  const token = `04${btoa(String.fromCharCode(...Array.from(uint8)))}`;
  // console.log('generateToken', iv.length, body, token);

  return token;
}

const zim = ZIM.create(1237665297);

const useZim = (
  appID: number,
  serverSecret: string,
  roomState: RoomState,
  createRoom?: boolean
) => {
  useEffect(() => {
    // 错误消息回调
    zim?.on('error', function (zim, errorInfo) {
      console.error(errorInfo.code, errorInfo.message);
    });

    // 连接状态变更回调
    zim?.on(
      'connectionStateChanged',
      function (zim, state, event, extendedData) {
        console.error(state, event, extendedData);
      }
    );

    // 房间状态变更回调
    zim?.on(
      'roomStateChanged',
      function (zim, state, event, extendedData, roomID) {
        console.error(roomID, state, event, extendedData);
      }
    );

    // 成员加入房间回调
    zim?.on('roomMemberJoined', function (zim, memberList, roomID) {
      console.error(memberList, roomID);
    });

    // 成员离开房间回调
    zim?.on('roomMemberLeft', function (zim, memberList, roomID) {
      console.error(memberList, roomID);
    });

    // 收到房间消息回调
    zim?.on('receiveRoomMessage', function (zim, messageList, fromRoomID) {
      console.error(messageList, fromRoomID);
    });

    // 收到单聊通信的消息回调
    zim?.on('receivePeerMessage', function (zim, messageList, fromUserID) {
      console.error(messageList, fromUserID);
    });

    // 令牌即将过期的提醒回调
    zim?.on('tokenWillExpire', function (zim, second) {
      console.error(second);
      // 可以在这里调用 renewToken 接口来更新 token
      // 新 token 生成可以参考上文
      // zim
      //   .renewToken(token)
      //   .then(function (token) {
      //     // 更新成功
      //   })
      //   .catch(function (err) {
      //     // 更新失败
      //   });
    });
  }, []);

  // Login
  const token = generateToken(roomState.userId, appID, serverSecret);

  /**
   * 用户登录
   */
  const [isLogin, setIsLogin] = useState(false);
  const Login = useCallback(async () => {
    if (!zim) return;
    if (roomState.userId === '') return;
    try {
      await zim?.login(
        {
          userID: roomState.userId,
          userName: roomState.userName,
        },
        token
      );
      console.log('登录成功', {
        userID: roomState.userId,
        userName: roomState.userName,
      });
      setIsLogin(true);
    } catch (err) {
      console.error('login', err);
    }
  }, [roomState.userId, roomState.userName, token]);
  // 执行登录
  useEffect(() => {
    isLogin || Login();
  }, [Login, isLogin]);

  const createOrJoinRoom = useCallback(async () => {
    if (roomState.userId === '') return;
    try {
      if (createRoom) {
        // 创建即时通讯房间
        const roomInfo = await zim?.createRoom({
          roomID: roomState.roomId,
          roomName: roomState.userName,
        });
        console.log('创建房间成功', roomInfo);
      } else {
        // 加入即时通讯房间
        const roomInfo = await zim?.joinRoom(roomState.roomId);
        console.log('加入房间成功', roomInfo);
      }
    } catch (error) {
      console.error(error);
    }
  }, [createRoom, roomState.roomId, roomState.userId, roomState.userName]);
  // 创建或加入房间
  useEffect(() => {
    isLogin && createOrJoinRoom();
  }, [createOrJoinRoom, isLogin]);

  // 已经发送的消息
  const [sendMsg, setSendMsg] = useImmer<ZIMMessage[]>([]);
  const toSendMsg = async (msg: string) => {
    const zimMsg: ZIMMessage = {
      priority: 1,
      type: 1,
      message: msg,
      messageID: '',
      userID: roomState.userId,
      timestamp: new Date().getTime(),
    };
    console.log(zimMsg);
    try {
      await zim?.sendRoomMessage(zimMsg, roomState.roomId);
      setSendMsg((d) => {
        d.push(zimMsg);
      });
    } catch (error) {
      console.error(error);
    }
  };

  return {
    zim: zim,
    sendMsg,
    toSendMsg,
  };
};

export default useZim;

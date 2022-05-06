import { Avatar } from '@nextui-org/react';
import classNames from 'classnames';

type Props = {
  username: string;
  msg: string | Uint8Array;
  isSelf: boolean;
};

const MessageCard = ({ username, msg, isSelf }: Props) => {
  return (
    <>
      <div
        className={classNames(
          'flex my-4 items-center',
          isSelf && 'justify-end'
        )}
      >
        <div>
          {!!isSelf || <div>{username}</div>}
          <div
            className={classNames(
              'whitespace-pre',
              'py-2 px-3 text-white',
              'rounded-lg mr-3',
              isSelf && 'bg-blue-500'
            )}
          >
            {msg}
          </div>
        </div>

        <div>
          <Avatar text={username} size="lg" />
        </div>
      </div>
    </>
  );
};

export default MessageCard;

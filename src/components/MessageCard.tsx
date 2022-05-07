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
          'flex my-4',
          'justify-end',
          isSelf || 'flex-row-reverse'
        )}
      >
        <div className="mx-3">
          {!!isSelf || <div className="text-sm">{username}</div>}
          <div
            className={classNames(
              'whitespace-pre',
              'py-2 px-3',
              'rounded-lg',
              isSelf ? 'bg-blue-500' : 'bg-gray-200',
              isSelf && 'text-white'
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

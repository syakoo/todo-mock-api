# 素振り用 Todo API

> **Warning**
> 現在ブラウザ用にしか作っていません。

技術を素振りする用の Todo API です。
MSW を使用しているため、どこかの API だったり自分でサーバーを立てる必要なく素振りすることができます。

## 使い方

npm のパッケージとして公開できるわけがないので、このリポジトリからインストールしてください:

```bash
npm i -D syakoo/todo-mock-api
# or
npm i -D git+https://github.com/syakoo/todo-mock-api
# yarn だと後者のように直接指定しないといけないらしい
```

MSW を使用しているので、初期化コマンドを打つ必要があります:

```bash
npx msw init <PUBLIC_DIR> [options]
```

あとはプロジェクトのルートなどで worker を実行することでブラウザ用の Mock API が起動されます:

```tsx
// 概略
import { startWorker } from '@syakoo/todo-mock-api';

startWorker();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## API ドキュメント

GitHub Pages で公開しています。

## 使い方の詳細

### startWorker

worker の起動時に、初期データやデータの保管方法などのオプションを入力することができます。
ログイン処理をすっ飛ばしたいときなどに使ってください:

```tsx
import { startWorker, GlobalState } from '@syakoo/todo-mock-api';

const initialState: GlobalState = {
  users: [
    {
      id: 'user1',
      username: 'username',
      password: 'password',
      token: 'token', // ここでトークンを設定できる
    },
  ],
  tasks: [
    {
      id: 'task1',
      userId: 'user1',
      title: 'Sample Task 1',
      detail: 'XXXXXXXXXXXXXXXX',
      is_complete: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'task2',
      userId: 'user1',
      title: 'Sample Task 2',
      is_complete: false,
      created_at: new Date().toISOString(),
    },
  ],
};

// データを保存しない (ブラウザのリロードで初期値に戻る)
startWorker({ initialState, storeType: 'nothing' });
```

### 型情報

`ApiUsersRegister`、`ApiUsersLogin`、`ApiUsersLogout` などエンドポイント毎に正常時のレスポンスの型情報を取得することができます。例えば、`/api/tasks/:taskId` である `ApiTasksId` は次のような型になっています:

```ts
export interface ApiTasksId {
  params: {
    taskId: string;
  };
  get: {
    resBody: taskFeature.Task;
  };
  patch: {
    reqBody: {
      title?: string;
      detail?: string;
    };
    resBody: taskFeature.Task;
  };
  delete: {
    resBody: {
      success: boolean;
    };
  };
}
```

エラー時のレスポンスボディの型は `HTTPErrorResponseBody` から得ることができ、エラーコードは `AppErrorCode` になっています。

### fetch 関数の提供


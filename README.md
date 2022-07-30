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
import { startWorker } from '@syakoo/todo-mock-api';

startWorker();
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
    resBody: null;
  };
  delete: {
    resBody: null;
  };
}
```

エラー時のレスポンスボディの型は `AppApiError` から得ることができ、エラーコードは `AppApiErrorCode` になっています。

### fetch 関数の提供

技術を素振りするにあたっていちいち仕様書見て `fetch` 関数使って実装するのは面倒だと思います。
そのために、ここでは `fetch` 関数も提供しています。

`restApi` は REST API のクライアントであり、次のようにして使用することができます:

```ts
import { client } from '@syakoo/todo-mock-api';

// [POST] /api/users/register
await client.restApi.users.register.post({
  username: 'user',
  password: 'pass',
});

// [POST] /api/users/logout
await client.restApi.users.logout.post('token');

// [GET] /api/tasks
await client.restApi.tasks.get('token');

// [POST] /api/tasks
await client.restApi.tasks.post(
  {
    title: 'title',
    detail: 'detail',
  },
  'token'
);

// [DELETE] /api/tasks/:taskId
await client.restApi.tasks._taskId('taskId').delete('token');

// [PUT] /api/tasks/:taskId/completion
await client.restApi.tasks._taskId('taskId').completion.put('token');
```

返り値はプロパティ `ok` と `body` を持ったオブジェクトであり、`ok` が true であれば成功時のレスポンス、false であればエラー時のレスポンスボディが `body` に格納されます:

```ts
type Res =
  | {
      ok: true;
      body: ...; // 成功時のレスポンスボディ
    }
  | {
      ok: false;
      body: AppApiError;
    };
```

## 注意事項

- 突然変更が起こる可能性があります。
- 素振り以外の用途では基本使わないほうがいいでしょう。

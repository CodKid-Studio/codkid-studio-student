# 先生ブロック定義 JSON の形(schemaVersion 1)

生徒アプリは、教材を開くときに先生ブロックの定義をこの形で受け取ります(スペック S-03)。
API はこの形でデータを返してください。

- 生徒アプリで受け取る場所:`packages/scratch-gui/src/codkid/teacher-blocks/definition-source.js`
- 検証する場所:`packages/scratch-vm/src/codkid/teacher-blocks/definitions.js`
- サンプル:`packages/scratch-gui/src/codkid/teacher-blocks/samples/lesson-sample.json`
  (開発ビルドで `?codkidTeacherBlocksSample=lesson-sample` を付けると読み込まれます)

## 全体の形

```json
{
  "schemaVersion": 1,
  "definitions": [ /* 定義。並び順がパレットでの並び順になる */ ]
}
```

- `schemaVersion` が 1 でない、または `definitions` が配列でない場合は、全体を無効とします。
  このとき、先生ブロックは1つも読み込みません。
- 1つの定義が不正な場合は、その定義だけを飛ばして警告を出します。ほかの定義は読み込みます。
- 同じ `id` と `version` の組が2回出てきた場合は、後のほうを使います。

## 定義

```json
{
  "id": "walk",
  "version": 1,
  "text": "Walk [STEPS] steps",
  "inputs": [{"name": "STEPS", "type": "number", "default": 1}],
  "variables": [],
  "warp": false,
  "spriteOnly": false,
  "deleted": false,
  "blocks": { /* 中身。sb3 のブロック形式(下の説明を参照) */ }
}
```

| 欄 | 必須 | 型 | 意味 |
|---|---|---|---|
| `id` | ○ | 文字列 | 先生ブロックの名前。英字で始め、英字と数字だけを使います(`_` は使えません)。版が変わっても同じ値にします。 |
| `version` | ○ | 整数(1 以上) | 版。中身を変えたら必ず上げます(「版の決まり」を参照)。 |
| `text` | ○ | 文字列 | ブロックに表示する文。入力は `[入力名]` で書きます。英語・短い文にします。 |
| `inputs` | | 配列 | 入力。省略または `[]` は入力なしです。 |
| `variables` | | 配列 | 中身で使う変数・リスト・メッセージ。 |
| `warp` | | 真偽値 | `true` なら「画面を再描画せずに実行する」。既定は `false`。 |
| `spriteOnly` | | 真偽値 | `true` ならステージのパレットには出しません。既定は `false`。 |
| `deleted` | | 真偽値 | `true` ならパレットに出しません(「削除」の扱いを参照)。既定は `false`。 |
| `blocks` | | オブジェクト | 中身。省略または `{}` なら何もしないブロックになります。 |

### inputs(入力)

```json
{"name": "STEPS", "type": "number", "default": 1}
```

| 欄 | 必須 | 意味 |
|---|---|---|
| `name` | ○ | 入力名。英字で始め、英字・数字・`_` を使います。1つの定義の中で重ならないようにします。 |
| `type` | ○ | `"number"`(数字)か `"string"`(文字)。スペックの「数字 / 文字 / なし」の「なし」は、`inputs` を空にすることで表します。 |
| `default` | | 既定値。`number` なら数、`string` なら文字列にします。省略すると `0` または `""` になります。 |

- すべての入力は、`text` にちょうど1回 `[入力名]` として出てくる必要があります。
- `text` の中の `[...]` は、すべて入力名でなければなりません。

### variables(変数)

```json
{"name": "Score", "type": "variable"}
```

| 欄 | 必須 | 意味 |
|---|---|---|
| `name` | ○ | 名前。 |
| `type` | | `"variable"`(既定)、`"list"`、`"broadcast"`(メッセージ)。 |

- 変数はすべて**ステージ(すべてのスプライト用)**の変数として扱います。
- 作品にその名前の変数がなければ、先生ブロックを入れるときにステージに作ります。
- 中身で使う変数は、すべてここに書く必要があります。書いていないものがあると、その定義は無効です。

### blocks(中身):sb3 のブロック形式

`blocks` は、.sb3 ファイルの `project.json` にある、各スプライトの `"blocks"` と同じ形です。
キーはブロック id で、値はブロックです。ブロック id は定義の中で重ならなければ何でもかまいません。
生徒アプリが読み込むときに付け直します。

決まり:

1. **スクリプトは1つだけ**にします。
   - 最初のブロックは `"topLevel": true`、`"parent": null` にします。
   - `procedures_definition`(「定義」の帽子ブロック)と `procedures_prototype` は**入れません**。
     生徒アプリが作ります。
   - ほかのブロックは、すべてこのスクリプトにつながっている必要があります。
2. **入力の値**は、引数レポーター `argument_reporter_string_number` を使います。
   `fields.VALUE` の値を入力名にします。

   ```json
   "a3": {"opcode": "argument_reporter_string_number", "parent": "a2", "next": null,
          "inputs": {}, "fields": {"VALUE": ["STEPS", null]}, "shadow": false, "topLevel": false}
   ```
3. **変数**のフィールドは `[名前, id]` で書きます(例:`"VARIABLE": ["Score", "any-id"]`)。
   - id は無視して、名前でステージの変数につなぎます。
   - 名前と種類は `variables` に書いてあるものと合わせます。
4. **使えるブロック**:
   - Scratch 3 の基本カテゴリ(動き、見た目、音、イベント、制御、調べる、演算、変数)
   - 拡張機能の「ペン」(`pen_`)と「音楽」(`music_`)
5. **使えないブロック**:
   - 帽子ブロック(`event_when…`、`control_start_as_clone`)
   - My Blocks(`procedures_…`)
   - 先生ブロック(`codkidLesson_…`)
   - 真偽値の引数(`argument_reporter_boolean`)
   - ほかの拡張機能

**エディタで作る場合**:管理者がエディタで My Block を組み、作品を書き出したとします。
`project.json` の定義ブロックの `next` から下のブロックを取り出せば、この形になります。
そのとき、次のように手を入れます。

- 最初のブロックを `topLevel: true`、`parent: null` にする。
- 引数レポーターの名前を入力名にそろえる。

例(`Walk [STEPS] steps`、v1):

```json
{
  "id": "walk",
  "version": 1,
  "text": "Walk [STEPS] steps",
  "inputs": [{"name": "STEPS", "type": "number", "default": 1}],
  "variables": [],
  "blocks": {
    "w1": {"opcode": "motion_movesteps", "next": "w4", "parent": null,
           "inputs": {"STEPS": [3, "w2", [4, ""]]}, "fields": {},
           "shadow": false, "topLevel": true, "x": 0, "y": 0},
    "w2": {"opcode": "operator_multiply", "next": null, "parent": "w1",
           "inputs": {"NUM1": [3, "w3", [4, ""]], "NUM2": [1, [4, "10"]]}, "fields": {},
           "shadow": false, "topLevel": false},
    "w3": {"opcode": "argument_reporter_string_number", "next": null, "parent": "w2",
           "inputs": {}, "fields": {"VALUE": ["STEPS", null]}, "shadow": false, "topLevel": false},
    "w4": {"opcode": "looks_nextcostume", "next": null, "parent": "w1",
           "inputs": {}, "fields": {}, "shadow": false, "topLevel": false}
  }
}
```

`Add Score [POINTS]` のように変数を使う例は、サンプルファイルにあります。

## 版の決まり

- 中身・文・入力を変えたら、`version` を上げます。**同じ `id` と `version` で中身を変えてはいけません。**
  すでに保存された作品には古い中身が入っているので、作品によって動きが違ってしまいます。
- 作品には、作ったときの版の定義がそのまま保存されます。
  - 例:`walk` v1 を使って作った作品は、教材が v2 になっても v1 のまま動きます。
- パレットには、`id` ごとに**いちばん大きい版**だけが出ます。古い版も送ってかまいません。
  - 古い版を送っておくと、バックパックなどから古い版のブロックが来たときに、その版を使えます。

## 「削除」の扱い

スペックの「削除は非表示扱いで、定義は残す」は、次のように表します。

- いちばん大きい版に `"deleted": true` を付けるか、その `id` を送らない。
  - どちらでも、パレットからは消えます。
- それを使った作品は、作品に入っている定義でそのまま動きます。

## パレットに出す先生ブロックを選ぶ(ブロック表示設定)

教材ごとのブロック表示設定(`packages/scratch-gui/src/codkid/block-visibility/`)の
`categories.lesson` で、版を付けない `id` を使って選べます。

```json
{"schemaVersion": 1, "categories": {"lesson": {"onlyBlocks": ["walk", "addScore"]}}}
```

- `onlyBlocks`:ここに書いたものだけを出す。
- `hideBlocks`:ここに書いたものを出さない。
- Lesson カテゴリは常に表示します。`show` は無視します。

## 生徒アプリの中での表し方(参考:S-13 の書き出し変換用)

| もの | 形 | 例 |
|---|---|---|
| 拡張機能 id(カテゴリ id) | `codkidLesson` | |
| ブロックの opcode | `codkidLesson_<id>_v<version>` | `codkidLesson_walk_v1` |
| 隠し定義の proccode | `codkid <id> v<version>`(入力1つにつき ` %s`) | `codkid walk v1 %s` |
| 隠し定義の目印 | `procedures_prototype` の mutation の `codkiddef` 属性(JSON) | `{"id":"walk","version":1,…}` |

- 隠し定義は、ふつうの My Block の定義と同じブロックです。
  - 目印が付いているので、ワークスペースには表示しません。
  - すべてのスプライトとステージに入れます。
- S-13(本家 Scratch 向けの書き出し)では、次のように変換すれば、ふつうの My Block になります。
  1. 先生ブロックを `procedures_call` に書き換える(proccode と引数 id は目印から分かる)。
  2. 目印を外す。
  3. 使っていない定義を消す。
- 引数 id は入力名と同じです。

## 生徒アプリでの既知の制限

- 子どもが、先生ブロックの使う変数の名前を変えることがあります(例:`Score` → `Points`)。
  - 作品の中の先生ブロックは、新しい名前の変数を使い続けます。
  - そのあとで定義を入れたスプライトには、元の名前(`Score`)の変数が別に作られます。
- 子どもがパレットで、先生ブロックの使う変数を削除することがあります。
  - その変数は、同じ名前でステージにすぐ作り直されます。
- 別の作品のバックパックから来たスクリプトに、この教材が知らない版の先生ブロックが入っていることがあります。
  - そのスクリプトは追加しません(警告だけを出します)。
  - 古い版も API から送っておけば、この制限は起きません。
- Lesson 拡張を読み込んだあとで先生ブロックが1つもなくなると、Lesson カテゴリは空のまま表示されます。

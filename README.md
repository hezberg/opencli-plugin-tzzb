# opencli-plugin-tzzb

同花顺投资账本持仓查询 OpenCLI 插件。

## 安装

```bash
opencli plugin install https://github.com/hezberg/opencli-plugin-tzzb
```

## 使用

```bash
# 首次使用：初始化账户（自动保存账户 ID）
opencli tzzb init

# 查看账户状态
opencli tzzb status

# 查询持仓（默认输出6列：代码、名称、当日盈亏、当日盈亏率、持仓市值、仓位占比）
opencli tzzb pos

# 刷新后查询（获取最新数据）
opencli tzzb pos --refresh

# 独立刷新页面
opencli tzzb reload

# 按市值降序
opencli tzzb pos --sortby value --sort des

# 按持有盈亏升序
opencli tzzb pos --sortby holdprofit --sort asc

# 按持有天数降序
opencli tzzb pos --sortby holddays --sort des

# 自定义输出字段
opencli tzzb pos --data code,name,dp,hp,value,hr
opencli tzzb pos --data code,name,dpr,hpr,hr,hd  # 只看盈亏率和仓位
opencli tzzb pos --data name,value,dp,dpr,hp,hpr  # 只看名称和盈亏相关
```

## 参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--sortby` | `dayprofit` | 排序字段：value(市值)、dayprofit(当日盈亏)、holdprofit(持有盈亏)、holddays(持有天数) |
| `--sort` | `des` | 排序方向：asc(升序)、des(降序) |
| `--data` | `code,name,dp,dpr,value,hr` | 输出字段（逗号分隔），详见下方字段说明 |
| `--refresh` | `false` | 查询前刷新页面以获取最新数据 |

## 输出字段说明

| 标识 | 中文列名 | 说明 |
|------|----------|------|
| `code` | 代码 | 股票代码 |
| `name` | 名称 | 股票名称 |
| `value` | 持仓市值 | 持仓股票的总市值 |
| `dp` | 当日盈亏 | 当日盈亏金额（格式：+1234.56） |
| `dpr` | 当日盈亏率 | 当日盈亏百分比（格式：+1.23%） |
| `hp` | 持有盈亏 | 持有期间盈亏金额 |
| `hpr` | 持有盈亏率 | 持有期间盈亏百分比 |
| `hd` | 持仓天数 | 持有该股票的天数 |
| `hr` | 持仓比例 | 占总资产比例 |
| `cost` | 成本 | 买入成本价 |
| `price` | 现价 | 当前市场价格 |

**默认输出**：`code,name,dp,dpr,value,hr`（代码、名称、当日盈亏、当日盈亏率、持仓市值、仓位占比）

## 输出格式

默认 Markdown 表格，可通过 `-f` 参数切换：

```bash
opencli tzzb pos -f json    # JSON
opencli tzzb pos -f yaml    # YAML
opencli tzzb pos -f csv     # CSV
opencli tzzb pos -f table   # 终端表格
```

## 登录

首次使用需要初始化账户：

```bash
# 初始化账户（打开浏览器登录，自动保存账户 ID）
opencli tzzb init

# 查看已保存的账户状态
opencli tzzb status
```

在打开的浏览器窗口中登录同花顺账号，登录成功后账户 ID 会自动保存到本地配置文件 `~/.opencli/profiles/default/tzzb/account.json`，后续查询无需再次登录。

> **隐私保护**：账户 ID 保存在本地，不会上传到 GitHub 或任何远程服务器。

## License

MIT

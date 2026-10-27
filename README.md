# Rick · 教练学习工具系列

学习卡片、原创题库与训练现场工具，部署于现有 GitHub Pages。

- [学习卡片 · 题库系列](https://heracles1983.github.io/rick-coach-challenge/quiz-series/)
- [训练决策挑战](https://heracles1983.github.io/rick-coach-challenge/)
- [会员课前询问卡](https://heracles1983.github.io/rick-coach-challenge/session-card/)

## 题库 Vol. 01 · 教练综合基础

参考 NSCA-CPT、CSCS、ACE、NASM、ACSM 官方公开学习领域编写，五方向各 12 道原创单选题，共 60 题。题目不是官方真题、授权教材或等比例全真模拟；得分不预测认证考试结果。参考资料链接和核对日期在题库页面中列明。

建议学习约 60 分钟：答题 45 分钟、解析复盘 15 分钟。整套计时挑战为 45 分钟，12 题专题为 9 分钟，按每题 45 秒设置；这是本工具的练习节奏，不是官方考试时限。逐题练习和翻卡均不限时。

支持逐题练习、计时挑战、学习翻卡、题号跳转、标记、错题重练、收藏、自动保存最近进度及导出复盘。手机、平板和桌面共用响应式界面。题库是纯静态页面，无账号、远程数据收集或第三方前端依赖。localStorage 仅保存当前浏览器学习记录；导出 JSON 用于备份查看，当前未实现导入或跨设备同步。

## 内容维护与扩展

`quiz-series/data/` 存放可维护的 JSON 题源，每题含唯一 ID、方向、领域、难度、四个选项、正确索引、解析、记忆点及参考来源标识。`questions.js` 是由题源生成的浏览器文件。新增系列时沿用这一结构，保持既有题目的 ID 稳定，并在首页加入新的卷次入口。

```sh
python scripts/build-bank.py
node --test tests/core.test.mjs
python -m http.server 8000
```

构建脚本验证题数、唯一 ID、选项和解释后生成题库。访问 `http://localhost:8000/quiz-series/` 预览；ES modules 需要 HTTP 服务。生产文件无需 npm 安装或构建，提交 `main` 后沿用仓库已配置的 GitHub Pages 分支发布。

题库仅供教练教育与知识巩固，不提供个人医疗诊断或处方。异常症状相关题目考查停止活动、应急处理和专业转介。

# TMB-H₂O₂ 智能比色检测

从 TMB 显色反应液照片中提取 ROI 颜色特征、建立 H₂O₂ 标准曲线，并预测未知样品浓度。页面使用 React + TypeScript，账号、标定方案和检测记录由 FastAPI 按用户保存。颜色计算在浏览器中完成，反应照片不会上传。

> 检测结果用于方法演示和课程项目，不能直接作为正式实验结论。

## 启动项目

环境要求：Node.js 18+，npm 9+，Python 3.11+。

本地开发需要同时启动接口和页面。接口默认使用 SQLite，数据在 `server/data/h2o2.db`。公开部署时把 `H2O2_DATABASE_URL` 改成 PostgreSQL，并设置 `H2O2_COOKIE_SECURE=true`。

```bash
python3 -m venv server/.venv
server/.venv/bin/pip install -r server/requirements.txt
npm install
npm run dev:api
npm run dev
```

两个命令各开一个终端。浏览器访问 `http://localhost:5173`。未登录会进入登录页。

默认邀请码是 `h2o2-class`，可在 `server/.env` 里用 `H2O2_INVITE_CODE` 修改。参考 `server/.env.example`。学生注册后，标定方案和检测记录只属于自己的账号。颜色计算仍在浏览器中完成，反应照片不会上传。

生产构建：

```bash
npm run build
npm run preview
```

预览服务器也需要把 `/api` 代理到已启动的接口，或设置 `VITE_API_BASE_URL`。

## 已实现功能

- 学号或邮箱注册（邀请码）、登录、退出。标定方案和检测记录按账号保存在服务器，学生之间互不可见。
- 仪表盘、标准曲线标定、未知样品检测、检测记录、标定方案管理和使用说明的完整路由。
- JPG / PNG 上传及移动端后置摄像头调用。
- 点击添加圆形 ROI、拖动、缩放、删除、边界约束和 Mock 自动孔位识别。
- 使用浏览器 Canvas API 提取 ROI 的 RGB 均值、中位数、灰度、归一化 RGB、纯白/纯黑像素比例。
- RGB、HSV、CIELAB 颜色特征，线性、加权线性、四参数 logistic、单调曲线，以及多通道集成学习。标定页按浓度留一比较这些信号。
- 轻量孔位识别会在照片上寻找反应孔；找不到时使用默认排列。队列编号、光照、拍摄日期和分光光度计参照可随方案保存。
- 两种标定模式：线性拟合，以及面向未知函数形式的单调非参数拟合。另有加权线性、四参数 logistic，以及用多个颜色通道取中位数的集成学习。
- 非参数模式使用 PAVA 保序回归去噪和 PCHIP 单调分段三次插值，支持曲线反解。
- 标定方案、默认方案和检测记录按登录用户保存在服务器。浏览器 localStorage 不再保存这些数据。
- 模拟浓度预测、±10% 预测区间、检测范围判断和图片质量检查。
- 标定方案 JSON 导入/导出，检测记录 JSON / CSV 导出。
- 一键安装 2 套标定方案和 4 条检测实例，可直接浏览正常、低于范围和高于范围状态。
- 浏览器实时生成标准光照、低照度、过曝反光和高浓度超范围四类 PNG 演示照片。

## Mock 算法逻辑

ROI 使用相对图片宽高的归一化坐标保存。提取颜色时，浏览器把原图绘制到隐藏 Canvas，并读取每个圆形 ROI 中心 72% 半径内的像素，避免孔壁对颜色的影响。

模拟吸光度使用：

```text
A = -log10((I_sample + 1) / (I_blank + 1))
```

其中 `I` 当前取 B 通道均值。回归以浓度为 x、所选颜色特征为 y；未知样品预测时对线性方程或单调样条进行反解。非参数模式不允许非单调曲线，因为同一颜色响应对应多个浓度时无法形成唯一预测。

拟合方法、论文依据和适用边界见 [`docs/modeling-research.md`](docs/modeling-research.md)。

图片质量检查包括整体亮度、接近纯白/纯黑像素比例、空白孔存在性和预测结果是否超出标定范围。自动孔位识别和置信区间目前均为 Mock 实现。仪表盘的“载入完整演示实例”不会重复写入相同 ID 的数据；标定页和检测页可通过“选择演示照片”直接载入不同质量场景。

## 数据与目录

```text
docs/                   # 建模说明和开题材料
server/app/             # FastAPI：账号、会话、标定方案和检测记录
src/
  auth/                 # 登录状态
  components/           # layout、image、roi、calibration、detection、ui
  pages/                # 业务页面和登录注册
  services/account/     # 当前用户的标定与检测缓存
  services/mock/        # 当前浏览器内的颜色分析
  services/api/         # HTTP 客户端，以及预留的图像分析接口
  lib/                  # Canvas、颜色、回归和导出工具
  types/                # 完整领域类型
```

服务器使用两张业务表，行内用 JSON 保存现有的标定方案和检测记录，并以 `user_id` 隔离：

- `calibrations`
- `detections`

账号和会话分别在 `users`、`sessions`。

## 接入真实图像分析

账号、标定方案和检测记录已经由 `server/app` 提供。颜色提取、拟合和浓度预测仍在浏览器中完成，算完后把结果提交到：

- `GET/POST /api/calibrations`，`POST /api/calibrations/:id/default`，`DELETE /api/calibrations/:id`
- `GET /api/detections`，`POST /api/detections/batch`，`DELETE /api/detections/:id`

`src/services/api/imageApi.ts` 和 `predictionApi.ts` 仍是预留。若以后把分析挪到服务器，可实现与 `ColorAnalysisService` 相同的接口，再替换页面里的 `mockColorAnalysisService`。

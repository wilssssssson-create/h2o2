# 标定模型与论文依据

## 结论

系统只提供两种用户可选模式：

1. **线性拟合**：用于已经通过实验确认的局部线性区间，模型为 `response = a + b × concentration`。
2. **未知形式拟合**：用于响应形式未知但整体单调、标准数据较多的情况。当前前端实现为加权 PAVA 保序回归加 PCHIP 单调分段三次插值。

未知形式不等于允许任意曲线。用于定量反算的标准曲线必须基本单调；否则同一颜色响应可能对应多个浓度，预测结果不唯一。

## 直接实验依据

Talapphet 与 Huh 在 TMB/H₂O₂/HRP 智能手机比色研究中报告：氧化产物在 450 nm 有吸收，在优化条件下，H₂O₂ 50–800 μM 范围内 UV-Vis 与智能手机读数都获得良好线性，报告的 R² 分别为 0.9964 和 0.9959。这支持“限定工作区间内采用线性校准”，但不证明所有试剂比例、反应时间、手机和浓度范围都必然线性。

- Talapphet, N.; Huh, C. S. (2024). *A Smartphone Colorimetric Development with TMB/H2O2/HRP Reaction System for Hydrogen Peroxide Detection and its Applications*. Journal of Analytical Chemistry, 79, 57–64. https://doi.org/10.1134/S1061934824010118

Khachornsakkul 与 Dungchai 的手机 H₂O₂/TMB 工作使用 HSV saturation 作为分析信号，并通过实验选择通道和线性工作范围。这说明手机颜色特征和有效范围应由标准数据验证，而不是仅由肉眼颜色或固定 RGB 通道决定。该研究使用 AgNP/TMB 体系，不是与本项目完全相同的 HRP 体系，因此只作为手机比色特征选择的旁证。

- Khachornsakkul, K.; Dungchai, W. (2020). *Development of an ultrasound-enhanced smartphone colorimetric biosensor for ultrasensitive hydrogen peroxide detection and its applications*. RSC Advances, 10, 24463–24471. https://doi.org/10.1039/D0RA03792C

## 非参数方法依据

PAVA（Pool-Adjacent-Violators Algorithm）用于在不指定函数形式的情况下求单调最小二乘拟合。当前实现按浓度聚合重复测量，以重复数作为权重，再自动判断递增或递减方向并进行保序拟合。

- de Leeuw, J.; Hornik, K.; Mair, P. (2009). *Isotone Optimization in R: Pool-Adjacent-Violators Algorithm (PAVA) and Active Set Methods*. Journal of Statistical Software, 32(5). https://doi.org/10.18637/jss.v032.i05

PAVA 的结果是阶梯函数。为了绘制连续曲线并进行稳定反解，系统采用 Fritsch–Carlson 单调分段三次 Hermite 插值。该方法在数据单调时避免普通三次样条可能产生的过冲和局部反向。

- Fritsch, F. N.; Carlson, R. E. (1980). *Monotone Piecewise Cubic Interpolation*. SIAM Journal on Numerical Analysis, 17(2), 238–246. https://doi.org/10.1137/0717021

对于后续 Python/FastAPI 版本，在数据量足够时，应升级为带平滑参数选择、批次效应和置信区间的形状约束 P-spline/SCAM。Pya 与 Wood 给出了形状约束加性模型的系统方法，可同时保持单调性与平滑性。

- Pya, N.; Wood, S. N. (2015). *Shape constrained additive models*. Statistics and Computing, 25, 543–559. https://doi.org/10.1007/s11222-013-9448-7

## 当前算法流程

```text
同浓度重复测量
  → 中位数聚合并记录重复数
  → 根据协方差判断递增/递减
  → 加权 PAVA 消除单调性违例
  → Fritsch–Carlson PCHIP 生成连续单调曲线
  → 二分法反解颜色响应对应的浓度
```

前端最低要求为 6 个不同浓度层级。正式模型建议使用至少 8–12 个浓度层级，每层多个重复，并按实验批次划分训练集和验证集。

## 正式验证要求

- 不应只比较训练集 R²；同时报告 RMSE、残差图、回算回收率和重复测量 CV。
- 使用按浓度留一验证或按实验批次留出验证，避免同一照片的重复孔同时进入训练和验证。
- 用 bootstrap 估计预测区间；范围外不做可靠外推，只报告低于或高于标定范围。
- 若数据明显非单调，应先检查曝光、反应时间、底物耗尽或高浓度 H₂O₂ 抑制，而不是强行拟合。
- 当前 PAVA + PCHIP 是可解释的前端原型算法，不等同于已经完成临床或分析方法学验证。

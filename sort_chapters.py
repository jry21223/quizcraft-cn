#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
from collections import OrderedDict

# 读取原始数据
with open('xigai.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 定义正确的章节顺序
correct_order = [
    "导论",
    "第一章 新时代坚持和发展中国特色社会主义",
    "第二章 以中国式现代化全面推进中华民族伟大复兴",
    "第三章 坚持党的全面领导",
    "第四章 坚持以人民为中心",
    "第五章 全面深化改革开放",
    "第六章 推动高质量发展",
    "第七章 建设社会主义现代化建设的教育、科技、人才战略",
    "第八章 发展全过程人民民主",
    "第九章 全面依法治国",
    "第十章 建设社会主义文化强国",
    "第十一章 以保障和改善民生为重点加强社会建设",
    "第十二章 建设社会主义生态文明",
    "第十三章 维护和塑造国家安全",
    "第十四章 建设巩固国防和强大人民军队",
    '第十五章 坚持"一国两制"和推进祖国完全统一',
    "第十六章 中国特色大国外交和推动构建人类命运共同体",
    "第十七章 全面从严治党"
]

# 按正确顺序重组数据
sorted_data = OrderedDict()
for chapter in correct_order:
    if chapter in data:
        sorted_data[chapter] = data[chapter]
    else:
        print(f"警告: 未找到章节 '{chapter}'")

# 检查是否有遗漏的章节
for chapter in data.keys():
    if chapter not in correct_order:
        print(f"警告: 原数据中有未列出的章节 '{chapter}'")
        sorted_data[chapter] = data[chapter]

# 保存排序后的数据
with open('xigai.json', 'w', encoding='utf-8') as f:
    json.dump(sorted_data, f, ensure_ascii=False, indent=2)

print("✓ 章节顺序已修正")
print(f"✓ 总章节数: {len(sorted_data)}")
print("\n排序后的章节:")
for i, ch in enumerate(sorted_data.keys(), 1):
    print(f"{i}. {ch}")

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Markdown 格式题库转换工具
支持 Markdown 语法的题库文件

使用方法：
python markdown_convert.py xigai.txt xigai.json
"""

import sys
import json
import re


def convert_markdown_to_json(txt_file, json_file):
    """将 Markdown 格式的题库转换为 JSON"""
    
    print(f"读取文件: {txt_file}")
    
    # 读取文本
    try:
        with open(txt_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        with open(txt_file, 'r', encoding='gbk') as f:
            content = f.read()
    
    # 分行处理
    lines = content.split('\n')
    
    result = {}
    current_chapter = None
    current_type = None
    current_question_lines = []
    
    def save_question():
        """保存当前题目"""
        if current_question_lines and current_chapter and current_type:
            question_text = '\n'.join(current_question_lines)
            
            if current_chapter not in result:
                result[current_chapter] = {}
            if current_type not in result[current_chapter]:
                result[current_chapter][current_type] = []
            
            result[current_chapter][current_type].append(question_text)
            print(f"  保存: {current_chapter} -> {current_type} -> 第 {len(result[current_chapter][current_type])} 题")
    
    print("\n开始解析...")
    
    for line in lines:
        stripped = line.strip()
        
        if not stripped:
            continue
        
        # 跳过 Markdown 分隔线
        if re.match(r'^-{3,}$', stripped):
            continue
        
        # Markdown 标题（章节）: # 标题 或 ## 标题
        if re.match(r'^#+\s+', stripped):
            save_question()
            # 移除 # 和空格，提取标题
            chapter_name = re.sub(r'^#+\s+', '', stripped)
            current_chapter = f"第{len(result) + 1}章 {chapter_name}" if not chapter_name.startswith('第') else chapter_name
            current_type = None
            current_question_lines = []
            print(f"\n章节: {current_chapter}")
            continue
        
        # Markdown 粗体题型: **一、单项选择题** 或 **单项选择题**
        if re.match(r'^\*\*.*?\*\*$', stripped):
            save_question()
            current_question_lines = []
            
            # 移除 ** 标记
            type_text = stripped.replace('**', '').strip()
            
            # 识别题型
            if '单项' in type_text or '单选' in type_text:
                current_type = '一、单项选择题'
            elif '多项' in type_text or '多选' in type_text:
                current_type = '二、多项选择题'
            elif '判断' in type_text:
                current_type = '三、判断题'
            else:
                # 如果有"一、" "二、" "三、"前缀，直接使用
                if re.match(r'^[一二三]、', type_text):
                    current_type = type_text
            
            if current_type:
                print(f"  题型: {current_type}")
            continue
        
        # 题号开头（新题目）
        # 支持: 1、 或 1. 格式
        if re.match(r'^\d+[、．.]', stripped):
            save_question()
            # 统一转换为 "数字、" 格式
            normalized_line = re.sub(r'^(\d+)[．.]', r'\1、', stripped)
            current_question_lines = [normalized_line]
            continue
        
        # 选项行（以 A. B. C. D. 或 A、B、C、D、开头）
        if re.match(r'^[A-D][\.、]', stripped):
            if current_question_lines:
                # 统一转换为 "字母、" 格式
                normalized_line = re.sub(r'^([A-D])[．.]', r'\1、', stripped)
                current_question_lines.append(normalized_line)
            continue
        
        # 答案行
        if stripped.startswith('答案'):
            if current_question_lines:
                # 统一格式: 答案：X
                normalized_line = re.sub(r'^答案[:：\s]+', '答案：', stripped)
                current_question_lines.append(normalized_line)
            continue
        
        # 其他内容（题干的一部分）
        if current_question_lines:
            current_question_lines.append(stripped)
    
    # 保存最后一题
    save_question()
    
    # 保存 JSON
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    # 统计
    total = 0
    print(f"\n{'='*60}")
    print("转换完成！统计信息：")
    print(f"{'='*60}")
    
    for chapter, types in result.items():
        chapter_total = sum(len(qs) for qs in types.values())
        total += chapter_total
        print(f"{chapter}: {chapter_total} 题")
        for qtype, questions in types.items():
            print(f"  - {qtype}: {len(questions)} 题")
    
    print(f"\n总计: {total} 题")
    print(f"已保存到: {json_file}")
    
    # 显示第一题示例
    if result:
        first_chapter = list(result.keys())[0]
        first_type = list(result[first_chapter].keys())[0]
        first_question = result[first_chapter][first_type][0]
        
        print(f"\n示例题目 ({first_chapter} - {first_type}):")
        print("-" * 60)
        print(first_question[:400])
        if len(first_question) > 400:
            print("...")
    
    return result


def validate_json(json_file):
    """验证生成的 JSON 文件"""
    print(f"\n正在验证 {json_file}...")
    
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        issues = []
        
        for chapter, types in data.items():
            for qtype, questions in types.items():
                for idx, q in enumerate(questions, 1):
                    # 检查答案
                    if '答案' not in q:
                        issues.append(f"{chapter} - {qtype} - 题{idx}: 缺少答案")
                    
                    # 检查选择题选项
                    if qtype in ['一、单项选择题', '二、多项选择题']:
                        option_count = len(re.findall(r'\n[A-D]、', q))
                        if option_count < 2:
                            issues.append(f"{chapter} - {qtype} - 题{idx}: 选项不足({option_count}个)")
        
        if issues:
            print(f"⚠ 发现 {len(issues)} 个问题：")
            for issue in issues[:10]:
                print(f"  - {issue}")
            if len(issues) > 10:
                print(f"  ... 还有 {len(issues) - 10} 个问题")
        else:
            print("✓ 验证通过，格式正确！")
        
        return len(issues) == 0
    
    except Exception as e:
        print(f"✗ 验证失败: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        print("\n使用方法:")
        print("  python markdown_convert.py <输入txt文件> <输出json文件>")
        print("\n示例:")
        print("  python markdown_convert.py xigai.txt xigai.json")
        print("\n支持的 Markdown 格式:")
        print("  - 章节: # 标题 或 ## 标题")
        print("  - 题型: **一、单项选择题**")
        print("  - 题号: 1、或 1.")
        print("  - 选项: A. 或 A、")
        print("  - 答案: 答案：A 或 答案:A")
        sys.exit(1)
    
    txt_file = sys.argv[1]
    json_file = sys.argv[2]
    
    # 转换
    convert_markdown_to_json(txt_file, json_file)
    
    # 验证
    validate_json(json_file)

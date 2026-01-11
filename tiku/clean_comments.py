#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
清理题库中的注释文本
"""

import json
import re

def load_json_file(file_path):
    """加载JSON文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json_file(file_path, data):
    """保存JSON文件"""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def clean_question_text(question_text):
    """清理题目文本中的注释"""
    # 移除常见的注释模式
    patterns = [
        r'非常抱歉，.*',
        r'以下是为您.*',
        r'感谢您的细致检查.*',
        r'以下是.*内容：',
        r'补充的.*题库内容',
        r'补全的.*题库内容',
    ]

    cleaned_text = question_text
    for pattern in patterns:
        cleaned_text = re.sub(pattern, '', cleaned_text, flags=re.DOTALL)

    # 移除多余的空行
    cleaned_text = re.sub(r'\n\s*\n', '\n', cleaned_text)

    # 去除首尾空白
    cleaned_text = cleaned_text.strip()

    return cleaned_text

def clean_all_questions(data):
    """清理所有题目中的注释"""
    cleaned_data = {}

    for chapter, question_types in data.items():
        cleaned_data[chapter] = {}

        for q_type, questions in question_types.items():
            cleaned_questions = []

            for question in questions:
                cleaned_question = clean_question_text(question)
                cleaned_questions.append(cleaned_question)

            cleaned_data[chapter][q_type] = cleaned_questions

    return cleaned_data

def main():
    # 文件路径
    input_file = "xigai.json"
    output_file = "xigai_cleaned.json"

    print("开始清理题库注释...")
    print(f"输入文件: {input_file}")
    print(f"输出文件: {output_file}")

    # 加载原始文件
    original_data = load_json_file(input_file)

    # 清理注释
    print("清理注释文本...")
    cleaned_data = clean_all_questions(original_data)

    # 保存清理后的文件
    save_json_file(output_file, cleaned_data)

    # 统计信息
    original_count = 0
    cleaned_count = 0

    for chapter in original_data:
        for q_type in original_data[chapter]:
            original_count += len(original_data[chapter][q_type])
            cleaned_count += len(cleaned_data[chapter][q_type])

    print(f"清理完成!")
    print(f"原始题目数: {original_count}")
    print(f"清理后题目数: {cleaned_count}")

    # 检查清理效果
    print("\n检查清理效果...")
    issues_found = 0

    for chapter in original_data:
        for q_type in original_data[chapter]:
            for i in range(len(original_data[chapter][q_type])):
                original = original_data[chapter][q_type][i]
                cleaned = cleaned_data[chapter][q_type][i]

                if "非常抱歉" in cleaned or "以下是为您" in cleaned:
                    issues_found += 1
                    print(f"发现未清理的注释: {chapter} - {q_type} 第{i+1}题")

    if issues_found == 0:
        print("✅ 所有注释已清理干净!")
    else:
        print(f"⚠️  还有 {issues_found} 个注释未清理")

if __name__ == "__main__":
    main()
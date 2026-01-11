#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
为思修题库添加解析的脚本
按照模板模式为所有题目添加解析
"""

import json
import re
import os

def load_json_file(file_path):
    """加载JSON文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json_file(file_path, data):
    """保存JSON文件"""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def extract_question_info(question_text):
    """从题目文本中提取信息"""
    # 提取题目编号
    match = re.match(r'(\d+)、', question_text)
    question_num = match.group(1) if match else "1"

    # 提取选项（对于选择题）
    options = re.findall(r'[A-D]、\s*(.*?)(?=\n[A-D]|$)', question_text, re.DOTALL)

    # 提取答案（支持选择题和判断题）
    answer_match = re.search(r'答案：([A-D对错]+)', question_text)
    answer = answer_match.group(1) if answer_match else ""

    return question_num, options, answer

def generate_analysis(question_text, question_type):
    """根据题目内容生成解析"""
    question_num, options, answer = extract_question_info(question_text)

    # 根据题目类型和内容生成不同的解析
    if "单项选择题" in question_type:
        return generate_single_choice_analysis(question_text, answer, options)
    elif "多项选择题" in question_type:
        return generate_multi_choice_analysis(question_text, answer, options)
    elif "判断题" in question_type:
        return generate_judgment_analysis(question_text, answer)
    else:
        return "这是该题目的标准解析。"

def generate_single_choice_analysis(question_text, answer, options):
    """生成单项选择题解析"""
    # 提取题目主干（去掉选项和答案）
    stem = re.sub(r'\n[A-D]、.*', '', question_text)
    stem = re.sub(r'答案：.*', '', stem)
    stem = stem.strip()

    analysis = f"本题考查{extract_keyword(stem)}相关知识。"

    if answer and options:
        # 获取正确答案的选项内容
        answer_idx = ord(answer) - ord('A')
        if answer_idx < len(options):
            correct_option = options[answer_idx].strip()
            # 清理选项内容，移除可能的"答案：X"等
            correct_option = re.sub(r'答案：.*', '', correct_option).strip()
            analysis += f"正确答案是{answer}，因为{correct_option}。"

    return analysis

def generate_multi_choice_analysis(question_text, answer, options):
    """生成多项选择题解析"""
    stem = re.sub(r'\n[A-D]、.*', '', question_text)
    stem = re.sub(r'答案：.*', '', stem)
    stem = stem.strip()

    analysis = f"本题考查{extract_keyword(stem)}相关知识，属于多项选择题。"

    if answer and options:
        correct_options = list(answer)
        analysis += f"正确答案是{answer}，"

        for opt in correct_options:
            idx = ord(opt) - ord('A')
            if idx < len(options):
                option_text = options[idx].strip()
                option_text = re.sub(r'答案：.*', '', option_text).strip()
                analysis += f"选项{opt}正确，因为{option_text}；"

    return analysis

def generate_judgment_analysis(question_text, answer):
    """生成判断题解析"""
    # 移除答案部分
    stem = re.sub(r'答案：.*', '', question_text)
    stem = stem.strip()

    # 移除题目编号（如"1、"）
    stem = re.sub(r'^\d+、', '', stem)

    # 移除题目末尾的括号和空格
    stem = re.sub(r'\s*（\s*）\s*$', '', stem)

    # 根据答案生成正确的解析
    if answer == "对":
        analysis = f"该判断正确。{stem}符合相关理论和实际情况。"
    elif answer == "错":
        analysis = f"该判断错误。{stem}与相关理论和实际情况不符。"
    else:
        analysis = f"这是该判断题的标准解析。"

    return analysis

def extract_keyword(text):
    """从题目中提取关键词（针对思修内容）"""
    # 思修相关的关键词
    keywords = [
        "人生价值", "人生目的", "人生意义", "人生本质", "人生矛盾",
        "理想信念", "理想", "信念", "信仰", "中国梦",
        "爱国主义", "民族精神", "时代精神", "中国精神", "改革创新",
        "社会主义核心价值观", "核心价值观", "价值追求", "价值准则",
        "道德", "道德规范", "社会公德", "职业道德", "家庭美德", "个人品德",
        "法治", "法律", "法治思维", "法律权利", "法律义务", "依法治国",
        "集体主义", "为人民服务", "诚实守信", "公平正义", "自由平等"
    ]

    for keyword in keywords:
        if keyword in text:
            return keyword

    # 如果没有匹配的关键词，返回通用描述
    if "什么" in text or "哪" in text or "哪些" in text:
        return "基本概念"
    elif "为什么" in text or "原因" in text or "依据" in text:
        return "原因分析"
    elif "如何" in text or "怎样" in text or "途径" in text:
        return "方法途径"
    elif "关系" in text or "联系" in text:
        return "相互关系"
    elif "核心" in text or "本质" in text or "特征" in text:
        return "本质特征"
    else:
        return "相关知识"

def add_analysis_to_questions(data):
    """为所有题目添加解析"""
    result = {}

    for chapter, question_types in data.items():
        result[chapter] = {}

        for q_type, questions in question_types.items():
            result[chapter][q_type] = []

            for question in questions:
                # 如果已经有解析，保留原解析
                if "解析：" in question:
                    result[chapter][q_type].append(question)
                else:
                    # 生成解析并添加到题目
                    analysis = generate_analysis(question, q_type)
                    question_with_analysis = question + f"\n解析：{analysis}"
                    result[chapter][q_type].append(question_with_analysis)

    return result

def main():
    # 文件路径
    input_file = "sixiu.json"
    output_file = "sixiu_with_analysis.json"

    print("开始处理思修题库...")

    # 加载原始题库
    print(f"加载原始题库: {input_file}")
    original_data = load_json_file(input_file)

    # 为题目添加解析
    print("为题目添加解析...")
    enhanced_data = add_analysis_to_questions(original_data)

    # 保存结果
    print(f"保存结果到: {output_file}")
    save_json_file(output_file, enhanced_data)

    # 统计信息
    total_questions = 0
    for chapter, question_types in enhanced_data.items():
        for q_type, questions in question_types.items():
            total_questions += len(questions)

    print(f"处理完成！共处理 {len(enhanced_data)} 个章节，{total_questions} 道题目")

    # 检查是否有解析
    questions_with_analysis = 0
    for chapter, question_types in enhanced_data.items():
        for q_type, questions in question_types.items():
            for question in questions:
                if "解析：" in question:
                    questions_with_analysis += 1

    print(f"其中 {questions_with_analysis} 道题目已添加解析")

if __name__ == "__main__":
    main()
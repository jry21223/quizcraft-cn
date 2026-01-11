#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
为近代史题库添加解析的脚本
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
    match = re.match(r'(\d+)[\.．]', question_text)
    if not match:
        match = re.match(r'(\d+)、', question_text)
    question_num = match.group(1) if match else "1"

    # 提取选项（对于选择题）
    # 支持A.、A、A、等多种格式
    options = re.findall(r'[A-D][\.．]?\s*(.*?)(?=\n[A-D][\.．]?|$)', question_text, re.DOTALL)
    if not options:
        options = re.findall(r'[A-D]、\s*(.*?)(?=\n[A-D]、|$)', question_text, re.DOTALL)

    # 提取答案（支持选择题和判断题）
    answer_match = re.search(r'答案：([A-D对错]+)', question_text)
    answer = answer_match.group(1) if answer_match else ""

    return question_num, options, answer

def generate_analysis(question_text, question_type):
    """根据题目内容生成解析"""
    question_num, options, answer = extract_question_info(question_text)

    # 根据题目类型和内容生成不同的解析
    if "单项选择题" in question_type or "一、单项" in question_type:
        return generate_single_choice_analysis(question_text, answer, options)
    elif "多项选择题" in question_type or "二、多项" in question_type:
        return generate_multi_choice_analysis(question_text, answer, options)
    elif "判断题" in question_type or "三、判断" in question_type:
        return generate_judgment_analysis(question_text, answer)
    else:
        return "这是该题目的标准解析。"

def generate_single_choice_analysis(question_text, answer, options):
    """生成单项选择题解析"""
    # 提取题目主干（去掉选项和答案）
    stem = re.sub(r'\n[A-D][\.．]?.*', '', question_text)
    stem = re.sub(r'\n[A-D]、.*', '', stem)
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
    stem = re.sub(r'\n[A-D][\.．]?.*', '', question_text)
    stem = re.sub(r'\n[A-D]、.*', '', stem)
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

    # 移除题目编号（如"1、"或"1."）
    stem = re.sub(r'^\d+[\.．、]', '', stem)

    # 移除题目末尾的括号和空格
    stem = re.sub(r'\s*（\s*）\s*$', '', stem)

    # 根据答案生成正确的解析
    if answer == "对":
        analysis = f"该判断正确。{stem}符合历史事实和相关理论。"
    elif answer == "错":
        analysis = f"该判断错误。{stem}与历史事实和相关理论不符。"
    else:
        analysis = f"这是该判断题的标准解析。"

    return analysis

def extract_keyword(text):
    """从题目中提取关键词"""
    # 近代史相关关键词
    keywords = [
        "鸦片战争", "太平天国", "洋务运动", "戊戌变法", "辛亥革命",
        "五四运动", "中国共产党", "抗日战争", "解放战争", "新中国",
        "帝国主义", "封建主义", "官僚资本主义", "民族独立", "人民解放",
        "马克思主义", "毛泽东思想", "邓小平理论", "改革开放", "社会主义现代化"
    ]

    for keyword in keywords:
        if keyword in text:
            return keyword

    # 如果没有匹配的关键词，返回通用描述
    if "什么" in text or "哪" in text or "谁" in text:
        return "基本史实"
    elif "为什么" in text or "原因" in text or "目的" in text:
        return "历史原因"
    elif "如何" in text or "怎样" in text or "方式" in text:
        return "历史过程"
    elif "意义" in text or "影响" in text or "作用" in text:
        return "历史意义"
    else:
        return "历史知识"

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
    input_file = "chapters.json"
    output_file = "chapters_with_analysis.json"

    print("开始处理近代史题库...")

    # 加载题库
    print(f"加载题库: {input_file}")
    try:
        original_data = load_json_file(input_file)
    except FileNotFoundError:
        print(f"错误：找不到文件 {input_file}")
        return
    except json.JSONDecodeError as e:
        print(f"错误：JSON文件格式错误 - {e}")
        return

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
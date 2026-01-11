#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查思修题库答案正确性的脚本
"""

import json
import re

def load_json_file(file_path):
    """加载JSON文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def extract_answer(question_text):
    """从题目文本中提取答案"""
    answer_match = re.search(r'答案：([A-D对错]+)', question_text)
    return answer_match.group(1) if answer_match else None

def check_question_format(question_text, question_type):
    """检查题目格式是否正确"""
    issues = []

    # 检查是否有答案
    answer = extract_answer(question_text)
    if not answer:
        issues.append("缺少答案")

    # 检查选择题答案格式
    if "选择题" in question_type:
        if answer and not re.match(r'^[A-D]+$', answer):
            issues.append(f"选择题答案格式错误: {answer}")

    # 检查判断题答案格式
    if "判断题" in question_type:
        if answer and answer not in ["对", "错"]:
            issues.append(f"判断题答案格式错误: {answer}")

    # 检查是否有解析
    if "解析：" not in question_text:
        issues.append("缺少解析")

    return issues

def check_all_questions(data):
    """检查所有题目"""
    total_questions = 0
    issues_found = 0
    results = {}

    for chapter, question_types in data.items():
        results[chapter] = {}
        chapter_issues = 0

        for q_type, questions in question_types.items():
            results[chapter][q_type] = []
            type_issues = 0

            for i, question in enumerate(questions):
                total_questions += 1
                issues = check_question_format(question, q_type)

                if issues:
                    issues_found += len(issues)
                    type_issues += len(issues)
                    results[chapter][q_type].append({
                        "question_num": i + 1,
                        "issues": issues,
                        "preview": question[:100] + "..." if len(question) > 100 else question
                    })

            if type_issues > 0:
                chapter_issues += type_issues
                print(f"  {q_type}: {type_issues} 个问题")

        if chapter_issues > 0:
            print(f"{chapter}: {chapter_issues} 个问题")

    return total_questions, issues_found, results

def generate_report(total_questions, issues_found, results):
    """生成检查报告"""
    report = []
    report.append("=" * 60)
    report.append("思修题库答案检查报告")
    report.append("=" * 60)
    report.append(f"总题目数: {total_questions}")
    report.append(f"发现问题: {issues_found}")
    report.append(f"通过率: {((total_questions - issues_found) / total_questions * 100):.1f}%")
    report.append("")

    if issues_found == 0:
        report.append("✅ 所有题目格式正确！")
        return "\n".join(report)

    report.append("发现的问题:")
    report.append("")

    for chapter, question_types in results.items():
        chapter_has_issues = False

        for q_type, questions in question_types.items():
            if questions:
                if not chapter_has_issues:
                    report.append(f"\n{chapter}:")
                    chapter_has_issues = True

                report.append(f"  {q_type}:")
                for item in questions:
                    report.append(f"    第{item['question_num']}题: {', '.join(item['issues'])}")
                    # 显示题目预览
                    preview = item['preview'].replace('\n', ' ')
                    report.append(f"      预览: {preview[:80]}...")
                    report.append("")

    return "\n".join(report)

def main():
    # 文件路径
    input_file = "sixiu_with_analysis.json"

    print("开始检查思修题库答案...")
    print(f"加载文件: {input_file}")

    # 加载题库
    data = load_json_file(input_file)

    # 检查所有题目
    print("\n检查题目格式...")
    total_questions, issues_found, results = check_all_questions(data)

    # 生成报告
    report = generate_report(total_questions, issues_found, results)
    print("\n" + report)

    # 保存详细报告
    if issues_found > 0:
        report_file = "sixiu_answer_check_report.txt"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"\n详细报告已保存到: {report_file}")

if __name__ == "__main__":
    main()
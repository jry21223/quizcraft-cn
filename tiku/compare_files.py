#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
对比原始题库和带解析题库的脚本
确保内容一致性
"""

import json
import re

def load_json_file(file_path):
    """加载JSON文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def extract_question_content(question_text):
    """提取题目的主要内容（去除答案和解析）"""
    # 移除答案部分
    content = re.sub(r'答案：.*', '', question_text)
    # 移除解析部分
    content = re.sub(r'解析：.*', '', content)
    return content.strip()

def extract_answer(question_text):
    """提取答案"""
    answer_match = re.search(r'答案：([A-D对错]+)', question_text)
    return answer_match.group(1) if answer_match else None

def compare_questions(original_question, enhanced_question):
    """对比两个题目"""
    issues = []

    # 提取主要内容
    original_content = extract_question_content(original_question)
    enhanced_content = extract_question_content(enhanced_question)

    # 对比内容
    if original_content != enhanced_content:
        issues.append("题目内容不一致")

    # 提取答案
    original_answer = extract_answer(original_question)
    enhanced_answer = extract_answer(enhanced_question)

    # 对比答案
    if original_answer != enhanced_answer:
        issues.append(f"答案不一致: 原始={original_answer}, 带解析={enhanced_answer}")

    return issues

def compare_all_chapters(original_data, enhanced_data):
    """对比所有章节"""
    total_compared = 0
    issues_found = 0
    results = {}

    # 检查章节是否一致
    original_chapters = set(original_data.keys())
    enhanced_chapters = set(enhanced_data.keys())

    if original_chapters != enhanced_chapters:
        print("警告: 章节不一致!")
        print(f"原始章节: {original_chapters - enhanced_chapters}")
        print(f"带解析章节: {enhanced_chapters - original_chapters}")

    # 对比共同章节
    common_chapters = original_chapters.intersection(enhanced_chapters)

    for chapter in common_chapters:
        results[chapter] = {}
        chapter_issues = 0

        # 检查题型是否一致
        original_types = set(original_data[chapter].keys())
        enhanced_types = set(enhanced_data[chapter].keys())

        if original_types != enhanced_types:
            print(f"警告: {chapter} 题型不一致!")
            continue

        # 对比每种题型
        for q_type in original_types:
            results[chapter][q_type] = []
            type_issues = 0

            original_questions = original_data[chapter][q_type]
            enhanced_questions = enhanced_data[chapter][q_type]

            # 检查题目数量
            if len(original_questions) != len(enhanced_questions):
                print(f"警告: {chapter} {q_type} 题目数量不一致!")
                continue

            # 对比每个题目
            for i in range(len(original_questions)):
                total_compared += 1
                issues = compare_questions(original_questions[i], enhanced_questions[i])

                if issues:
                    issues_found += len(issues)
                    type_issues += len(issues)
                    results[chapter][q_type].append({
                        "question_num": i + 1,
                        "issues": issues,
                        "original_preview": original_questions[i][:80] + "..." if len(original_questions[i]) > 80 else original_questions[i],
                        "enhanced_preview": enhanced_questions[i][:80] + "..." if len(enhanced_questions[i]) > 80 else enhanced_questions[i]
                    })

            if type_issues > 0:
                chapter_issues += type_issues

        if chapter_issues > 0:
            print(f"{chapter}: {chapter_issues} 个不一致")

    return total_compared, issues_found, results

def generate_comparison_report(total_compared, issues_found, results):
    """生成对比报告"""
    report = []
    report.append("=" * 60)
    report.append("题库对比报告")
    report.append("=" * 60)
    report.append(f"对比题目数: {total_compared}")
    report.append(f"发现不一致: {issues_found}")
    report.append(f"一致性: {((total_compared - issues_found) / total_compared * 100):.1f}%")
    report.append("")

    if issues_found == 0:
        report.append("✅ 所有题目内容一致！")
        return "\n".join(report)

    report.append("发现的不一致:")
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
                    report.append(f"      原始: {item['original_preview']}")
                    report.append(f"      带解析: {item['enhanced_preview']}")
                    report.append("")

    return "\n".join(report)

def main():
    # 文件路径
    original_file = "xigai_cleaned.json"
    enhanced_file = "xigai_with_analysis_final.json"

    print("开始对比题库文件...")
    print(f"原始文件: {original_file}")
    print(f"带解析文件: {enhanced_file}")

    # 加载文件
    original_data = load_json_file(original_file)
    enhanced_data = load_json_file(enhanced_file)

    # 对比文件
    print("\n对比题目内容...")
    total_compared, issues_found, results = compare_all_chapters(original_data, enhanced_data)

    # 生成报告
    report = generate_comparison_report(total_compared, issues_found, results)
    print("\n" + report)

    # 保存报告
    if issues_found > 0:
        report_file = "comparison_report.txt"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"\n详细报告已保存到: {report_file}")

if __name__ == "__main__":
    main()
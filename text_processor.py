import os
import json
from collections import defaultdict

def processor(filename: str) -> None:
    """
    :param filename: 处理的文件名，格式要求题号开头，选项无所谓
    """
    with open(filename, 'r', encoding='utf-8') as f:
        a = f.read().replace("\t", " ").split('\n')
    # print(a)
    b = []
    for i in a:
        temp = ""
        for j in range(0, len(i)):
            if i[j] == "（":
                temp += "（ "
                continue
            elif i[j] == "(":
                temp += "（ "
                continue
            elif i[j] == ")":
                temp += "）"
                if j == len(i) - 1: b.append(temp)
                continue
            if i[j] != " ": temp += i[j]
            try:
                if i[j + 1] in "ABCD":
                    b.append(temp)
                    temp = ""
            except IndexError:
                b.append(temp)
    # print(b)
    with open(filename, 'w', encoding='utf-8') as f:
        for i in b:
            f.write(i + '\n')

def text2json():
    with open("answer.txt", 'r', encoding='utf-8') as f:
        answer = [line.strip() for line in f.read().split('\n') if line.strip()]
    
    data_dict = defaultdict(lambda: defaultdict(list))
    files = sorted([f for f in os.listdir() if "chapter" in f and ".txt" in f])
    
    for i in files:
        with open(i, 'r', encoding='utf-8') as f:
            contents = [line.strip() for line in f.read().split('\n')]
        
        # 过滤空行
        contents = [c for c in contents if c]
        
        chapter = contents[0]
        item_type = contents[1]
        j = 2
        
        while j < len(contents):
            # 检查是否是新的题型标题
            if contents[j] in ["一、单项选择题", "二、多项选择题", "三、判断题"]:
                item_type = contents[j]
                j += 1
                continue
            
            # 跳过空行
            if not contents[j]:
                j += 1
                continue
            
            # 处理单选题和多选题
            if item_type == "一、单项选择题" or item_type == "二、多项选择题":
                # 确保有足够的行数
                if j + 4 < len(contents):
                    question_text = f"{contents[j]}\n{contents[j+1]}\n{contents[j+2]}\n{contents[j+3]}\n{contents[j+4]}"
                    if answer:
                        question_text += f"\n答案：{answer.pop(0)}"
                    data_dict[chapter][item_type].append(question_text)
                    j += 5
                else:
                    print(f"警告: {chapter} {item_type} 在第 {j} 行题目格式不完整")
                    break
            # 处理判断题
            else:
                if answer:
                    data_dict[chapter][item_type].append(f"{contents[j]}\n答案：{answer.pop(0)}")
                j += 1
    
    # 使用 ensure_ascii=False 保持中文，indent=2 格式化输出
    json_text = json.dumps(data_dict, ensure_ascii=False, indent=2)
    with open("chapters0.json", 'w', encoding='utf-8') as f:
        f.write(json_text)

def answers():
    with open("raw_answer.txt", 'r', encoding='utf-8') as f:
        contents = f.read().split('\n')
    flag = 0
    results = []
    for i in contents:
        if "单选" in i:
            flag = 0
        elif "多选" in i:
            flag = 1
        elif "判断" in i:
            flag = 2
        match flag:
            case 0:
                for j in i:
                    if j in "ABCD":
                        # print(i[i.find(j):])
                        results += list(i[i.find(j):])
                        break
            case 1:
                for j in i:
                    if j in "ABCD":
                        results += i[i.find(j):].split(' ')
                        break
            case 2:
                for j in i:
                    if j in "对错":
                        results += list(i[i.find(j):])
                        break
    with open("answer.txt", 'w', encoding='utf-8') as f:
        for i in results:
            if i != ' ': f.write(i+'\n')

if __name__ == "__main__":
    # 取消默认执行，需要手动调用
    # text2json()
    print("请根据需要调用以下函数：")
    print("1. processor(filename) - 预处理文本文件")
    print("2. answers() - 提取答案")
    print("3. text2json() - 转换为 JSON")
    print("\n当前配置为手动模式，请在代码中取消注释需要的函数")
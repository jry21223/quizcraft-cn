#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

import os
import json
import random
from collections import defaultdict

contents = None
wrongs = None
cor = 0
wr = 0
dis = 0
total = 0

LINE_WIDTH = 100


def normalize_bool_answer(ans: str):
    """将判断题文字答案归一化为布尔值。

    返回 True/False 表示“对/错”，返回 None 表示不是标准判断题格式。
    """
    ans = ans.strip().lower()
    if ans in ("对", "正确", "√", "true", "t", "yes", "y"):
        return True
    if ans in ("错", "错误", "×", "false", "f", "no", "n"):
        return False
    return None

def num():
    return sum(len(contents[chapter_name][item_type]) for chapter_name in contents.keys() for item_type
                in contents[chapter_name].keys())

def colorful_print(chapter_name, item_type, item):
    global cor, wr, dis, wrongs
    os.system("cls")
    cor_t = int(cor / total * LINE_WIDTH)
    wr_t = int(wr / total * LINE_WIDTH)
    dis_t = LINE_WIDTH - cor_t - wr_t
    print("\033[42m" + ' ' * cor_t + "\033[41m" + ' ' * wr_t + "\033[47m" + ' ' * dis_t + "\033[0m")
    print(f"\033[1;36m{chapter_name}\n\033[32m{item_type}\033[0m")
    
    # 解析题目、答案和解析
    if "答案：" in item:
        answer_idx = item.find("答案：")
        question_part = item[:answer_idx]
        rest = item[answer_idx + 3:].strip()
        
        # 检查是否有解析
        if "解析：" in rest:
            analysis_idx = rest.find("解析：")
            correct_answer = rest[:analysis_idx].strip()
            analysis = rest[analysis_idx + 3:].strip()
        else:
            correct_answer = rest
            analysis = ""
    else:
        question_part = item
        correct_answer = ""
        analysis = ""
    
    # 显示题目
    print(question_part)
    user_input = input().strip()

    # 先尝试把标准答案当作判断题的"对/错"来解析
    ans_bool = normalize_bool_answer(correct_answer)

    if ans_bool is not None and user_input.lower() in ("y", "n"):
        # y 表示你认为"对"，n 表示你认为"错"
        is_correct = (user_input.lower() == "y" and ans_bool) or (user_input.lower() == "n" and not ans_bool)
    else:
        # 其他情况：按字符串（大小写不敏感）比较
        is_correct = user_input.lower() == correct_answer.lower()
    
    if is_correct:
        cor += 1
        dis -= 1
        result_msg = "\033[1;36m✓ 正确！\033[0m"
    else:
        wr += 1
        dis -= 1
        wrongs[chapter_name][item_type].append(item)
        result_msg = f"\033[1;31m✗ 错误！正确答案：{correct_answer}\033[0m"
    
    # 显示结果和解析
    print("\n" + result_msg)
    if analysis:
        print(f"\n\033[1;33m📖 解析：\033[0m")
        print(f"\033[0;37m{analysis}\033[0m")
    
    input("\n\033[90m按回车继续...\033[0m")

def mode1():
    global dis, wrongs, total
    total = num()
    dis = total
    wrongs = defaultdict(lambda : defaultdict(list))
    for chapter_name in contents.keys():
        for item_type in contents[chapter_name].keys():
            for item in contents[chapter_name][item_type]:
                colorful_print(chapter_name, item_type, item)

def mode2():
    global dis, wrongs, total
    temp = num()
    while True:
        try:
            os.system("cls")
            total = int(input(f"请输入题目数量(? / {temp}) >> "))
        except:
            print("\033[41m请输入一个整数！\033[0m")
            input()
            continue
        else:
            if total > temp:
                print("\033[41m超出最大题目数量！\033[0m")
                input()
                continue
            elif total < 1:
                print("\033[41m题目数量不能小于1！\033[0m")
                input()
                continue
            break
    dis = total
    wrongs = defaultdict(lambda : defaultdict(list))
    for _ in range(total):
        chapter_name = random.choice(list(contents.keys()))
        item_type = random.choice(list(contents[chapter_name].keys()))
        item = random.choice(contents[chapter_name][item_type])
        colorful_print(chapter_name, item_type, item)

def mode3():
    os.system("cls")
    print("""
/**
 *               ii.                                         ;9ABH,          
 *              SA391,                                    .r9GG35&G          
 *              &#ii13Gh;                               i3X31i;:,rB1         
 *              iMs,:,i5895,                         .5G91:,:;:s1:8A         
 *               33::::,,;5G5,                     ,58Si,,:::,sHX;iH1        
 *                Sr.,:;rs13BBX35hh11511h5Shhh5S3GAXS:.,,::,,1AG3i,GG        
 *                .G51S511sr;;iiiishS8G89Shsrrsh59S;.,,,,,..5A85Si,h8        
 *               :SB9s:,............................,,,.,,,SASh53h,1G.       
 *            .r18S;..,,,,,,,,,,,,,,,,,,,,,,,,,,,,,....,,.1H315199,rX,       
 *          ;S89s,..,,,,,,,,,,,,,,,,,,,,,,,....,,.......,,,;r1ShS8,;Xi       
 *        i55s:.........,,,,,,,,,,,,,,,,.,,,......,.....,,....r9&5.:X1       
 *       59;.....,.     .,,,,,,,,,,,...        .............,..:1;.:&s       
 *      s8,..;53S5S3s.   .,,,,,,,.,..      i15S5h1:.........,,,..,,:99       
 *      93.:39s:rSGB@A;  ..,,,,.....    .SG3hhh9G&BGi..,,,,,,,,,,,,.,83      
 *      G5.G8  9#@@@@@X. .,,,,,,.....  iA9,.S&B###@@Mr...,,,,,,,,..,.;Xh     
 *      Gs.X8 S@@@@@@@B:..,,,,,,,,,,. rA1 ,A@@@@@@@@@H:........,,,,,,.iX:    
 *     ;9. ,8A#@@@@@@#5,.,,,,,,,,,... 9A. 8@@@@@@@@@@M;    ....,,,,,,,,S8    
 *     X3    iS8XAHH8s.,,,,,,,,,,...,..58hH@@@@@@@@@Hs       ...,,,,,,,:Gs   
 *    r8,        ,,,...,,,,,,,,,,.....  ,h8XABMMHX3r.          .,,,,,,,.rX:  
 *   :9, .    .:,..,:;;;::,.,,,,,..          .,,.               ..,,,,,,.59  
 *  .Si      ,:.i8HBMMMMMB&5,....                    .            .,,,,,.sMr
 *  SS       :: h@@@@@@@@@@#; .                     ...  .         ..,,,,iM5
 *  91  .    ;:.,1&@@@@@@MXs.                            .          .,,:,:&S
 *  hS ....  .:;,,,i3MMS1;..,..... .  .     ...                     ..,:,.99
 *  ,8; ..... .,:,..,8Ms:;,,,...                                     .,::.83
 *   s&: ....  .sS553B@@HX3s;,.    .,;13h.                            .:::&1
 *    SXr  .  ...;s3G99XA&X88Shss11155hi.                             ,;:h&,
 *     iH8:  . ..   ,;iiii;,::,,,,,.                                 .;irHA  
 *      ,8X5;   .     .......                                       ,;iihS8Gi
 *         1831,                                                 .,;irrrrrs&@
 *           ;5A8r.                                            .:;iiiiirrss1H
 *             :X@H3s.......                                .,:;iii;iiiiirsrh
 *              r#h:;,...,,.. .,,:;;;;;:::,...              .:;;;;;;iiiirrss1
 *             ,M8 ..,....,.....,,::::::,,...         .     .,;;;iiiiiirss11h
 *             8B;.,,,,,,,.,.....          .           ..   .:;;;;iirrsss111h
 *            i@5,:::,,,,,,,,.... .                   . .:::;;;;;irrrss111111
 *            9Bi,:,,,,......                        ..r91;;;;;iirrsss1ss1111
 */
    """)
    print("作者还没想好怎么自定义比较好")
    input()
    exit(0)

def main() -> None:
    global contents
    with open("chapters.json", 'r') as f:
        contents = json.load(f)
    while True:
        os.system("cls")
        print("=" * int(LINE_WIDTH / 2) + "历史期末刷题工具" + "=" * int(LINE_WIDTH / 2))
        print("=" * int(LINE_WIDTH / 2) + " @Author: sawd6 " + "=" * int(LINE_WIDTH / 2))
        choice = input("1）顺序做题\n2）随机出题\n3）自定义套题\n") or " "
        if choice in "123": break
        if choice == "114514":
            print("""
/**
 *                                         ,s555SB@@&                          
 *                                      :9H####@@@@@Xi                        
 *                                     1@@@@@@@@@@@@@@8                       
 *                                   ,8@@@@@@@@@B@@@@@@8                      
 *                                  :B@@@@X3hi8Bs;B@@@@@Ah,                   
 *             ,8i                  r@@@B:     1S ,M@@@@@@#8;                 
 *            1AB35.i:               X@@8 .   SGhr ,A@@@@@@@@S                
 *            1@h31MX8                18Hhh3i .i3r ,A@@@@@@@@@5               
 *            ;@&i,58r5                 rGSS:     :B@@@@@@@@@@A               
 *             1#i  . 9i                 hX.  .: .5@@@@@@@@@@@1               
 *              sG1,  ,G53s.              9#Xi;hS5 3B@@@@@@@B1                
 *               .h8h.,A@@@MXSs,           #@H1:    3ssSSX@1                  
 *               s ,@@@@@@@@@@@@Xhi,       r#@@X1s9M8    .GA981               
 *               ,. rS8H#@@@@@@@@@@#HG51;.  .h31i;9@r    .8@@@@BS;i;          
 *                .19AXXXAB@@@@@@@@@@@@@@#MHXG893hrX#XGGXM@@@@@@@@@@MS        
 *                s@@MM@@@hsX#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@&,      
 *              :GB@#3G@@Brs ,1GM@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@B,     
 *            .hM@@@#@@#MX 51  r;iSGAM@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@8     
 *          :3B@@@@@@@@@@@&9@h :Gs   .;sSXH@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@:    
 *      s&HA#@@@@@@@@@@@@@@M89A;.8S.       ,r3@@@@@@@@@@@@@@@@@@@@@@@@@@@r    
 *   ,13B@@@@@@@@@@@@@@@@@@@5 5B3 ;.         ;@@@@@@@@@@@@@@@@@@@@@@@@@@@i    
 *  5#@@#&@@@@@@@@@@@@@@@@@@9  .39:          ;@@@@@@@@@@@@@@@@@@@@@@@@@@@;    
 *  9@@@X:MM@@@@@@@@@@@@@@@#;    ;31.         H@@@@@@@@@@@@@@@@@@@@@@@@@@:    
 *   SH#@B9.rM@@@@@@@@@@@@@B       :.         3@@@@@@@@@@@@@@@@@@@@@@@@@@5    
 *     ,:.   9@@@@@@@@@@@#HB5                 .M@@@@@@@@@@@@@@@@@@@@@@@@@B    
 *           ,ssirhSM@&1;i19911i,.             s@@@@@@@@@@@@@@@@@@@@@@@@@@S   
 *              ,,,rHAri1h1rh&@#353Sh:          8@@@@@@@@@@@@@@@@@@@@@@@@@#:  
 *            .A3hH@#5S553&@@#h   i:i9S          #@@@@@@@@@@@@@@@@@@@@@@@@@A.
 *
 *
 *
 */
            """)
            input()
        elif choice == 'hyw':
            print("干嘛")
            input()
    try:
        match int(choice):
            case 1:
                mode1()
            case 2:
                mode2()
            case 3:
                mode3()
    except KeyboardInterrupt:
        pass
    os.system("cls")
    print(f"\033[1;36m正确题数：{cor}\n\033[1;31m错误题数：{wr}\n\033[1;33m未作答：{dis}\033[0m")
    if wr == 0 and dis == 0:
        print("\033[1;36m芜湖全对~\033[0m")
        input()
    elif (input("按下ENTER显示错误的题目，按下q以退出") or " ") not in "qQ":
        for chapter_name in wrongs.keys():
            print(f"\033[1;36m{chapter_name}\033[0m")
            for item_type in wrongs[chapter_name].keys():
                print(f"\033[1;32m{item_type}\033[0m")
                for item in range(len(wrongs[chapter_name][item_type])):
                    print(wrongs[chapter_name][item_type][item])
        input("按下ENTER以退出...")

if __name__ == "__main__":
    main()
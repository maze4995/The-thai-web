import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '사용 가이드 - The Thai Web',
}

function SectionCard({ id, number, title, children }: { id: string; number: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-[#0c0e18] rounded-xl border border-slate-700/20 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700/20 flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-[#D4A574] flex items-center justify-center text-xs font-bold text-white shrink-0">
          {number}
        </div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-4 text-sm text-slate-300 leading-relaxed">
        {children}
      </div>
    </section>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#D4A574]/10 border border-[#D4A574]/20 rounded-lg p-3 text-xs text-[#D4A574]">
      <b>TIP:</b> {children}
    </div>
  )
}

function KeyBadge({ children }: { children: React.ReactNode }) {
  return <span className="inline-block bg-[#1a2035] border border-slate-700/30 text-slate-200 text-xs font-bold px-2 py-0.5 rounded mx-0.5">{children}</span>
}

export default function GuidePage() {
  return (
    <div className="flex flex-col h-full bg-[#0f1117]">
      {/* Header */}
      <header className="shrink-0 border-b border-slate-700/40 bg-[#0f1117] px-8 py-4">
        <h1 className="text-xl font-bold text-white">사용 가이드</h1>
        <p className="text-slate-400 text-sm mt-1">The Thai Web 매장 관리 시스템 사용법</p>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          {/* TOC */}
          <nav className="bg-[#0c0e18] rounded-xl border border-slate-700/20 p-5">
            <h2 className="font-bold text-sm text-[#D4A574] mb-3">목차</h2>
            <ol className="grid grid-cols-2 gap-1.5 text-sm">
              {[
                { id: 'sidebar', label: '사이드바 네비게이션' },
                { id: 'schedule', label: '스케줄 조판지' },
                { id: 'date', label: '날짜 이동' },
                { id: 'manager', label: '담당자 설정' },
                { id: 'add-slot', label: '슬롯 추가' },
                { id: 'arrival', label: '손님 도착 처리' },
                { id: 'edit-slot', label: '슬롯 수정 / 삭제' },
                { id: 'drag', label: '드래그 앤 드롭' },
                { id: 'footer', label: '하단 매출 요약' },
                { id: 'therapist', label: '관리사 관리' },
                { id: 'stats', label: '통계' },
                { id: 'worklog', label: '업무일지' },
              ].map((item, i) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="text-slate-400 hover:text-[#D4A574] transition-colors">
                    {i + 1}. {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* 1. Sidebar */}
          <SectionCard id="sidebar" number="1" title="사이드바 네비게이션">
            <p>화면 왼쪽에 고정된 사이드바를 통해 모든 페이지로 이동할 수 있습니다.</p>
            <div className="bg-[#1a2035] rounded-lg p-4 space-y-2 text-xs">
              <div className="flex items-center gap-3"><span className="text-[#D4A574] font-bold">스케줄</span> <span className="text-slate-500">— 메인 조판지 화면</span></div>
              <div className="flex items-center gap-3"><span className="text-slate-300 font-bold">관리사</span> <span className="text-slate-500">— 관리사 추가/수정/출퇴근 관리</span></div>
              <div className="flex items-center gap-3"><span className="text-slate-300 font-bold">통계</span> <span className="text-slate-500">— 주간/월간 매출 통계</span></div>
              <div className="flex items-center gap-3"><span className="text-slate-300 font-bold">업무일지</span> <span className="text-slate-500">— 일일 업무 기록</span></div>
              <div className="flex items-center gap-3"><span className="text-slate-300 font-bold">가이드</span> <span className="text-slate-500">— 현재 페이지</span></div>
            </div>
            <p>사이드바 오른쪽 상단의 <KeyBadge>{'‹'}</KeyBadge> 버튼을 클릭하면 사이드바를 접거나 펼 수 있습니다.</p>
            <p>하단의 <b className="text-slate-200">로그아웃</b> 버튼으로 로그아웃할 수 있습니다.</p>
          </SectionCard>

          {/* 2. Schedule */}
          <SectionCard id="schedule" number="2" title="스케줄 조판지">
            <p>메인 화면인 조판지는 <b className="text-slate-200">상단 헤더</b>, <b className="text-slate-200">관리사별 칼럼</b>, <b className="text-slate-200">하단 매출 요약</b> 세 영역으로 구성됩니다.</p>
            <div className="bg-[#1a2035] rounded-lg p-4 text-xs space-y-3">
              <div>
                <span className="text-[#D4A574] font-bold">상단 헤더</span>
                <span className="text-slate-500 ml-2">날짜 이동, 담당자 설정</span>
              </div>
              <div>
                <span className="text-[#D4A574] font-bold">관리사 칼럼</span>
                <span className="text-slate-500 ml-2">출근한 관리사별 세로 칸에 슬롯 카드 표시</span>
              </div>
              <div>
                <span className="text-[#D4A574] font-bold">하단 요약</span>
                <span className="text-slate-500 ml-2">총매출, 결제수단별 금액, 고객유형, 커미션</span>
              </div>
            </div>
            <p>관리사가 5명 미만일 때도 최소 5칸 레이아웃을 유지하며, 5명 초과 시 자동으로 확장됩니다.</p>
          </SectionCard>

          {/* 3. Date */}
          <SectionCard id="date" number="3" title="날짜 이동">
            <p>상단 헤더 중앙의 날짜 영역에서 조판지 날짜를 변경할 수 있습니다.</p>
            <div className="flex items-center justify-center gap-2 bg-[#1a2035] rounded-lg p-5">
              <KeyBadge>{'◀'}</KeyBadge>
              <span className="text-slate-500 text-xs">전날</span>
              <span className="mx-2 text-[#D4A574] font-bold text-sm">2026년 4월 4일 (금)</span>
              <span className="text-slate-500 text-xs">다음날</span>
              <KeyBadge>{'▶'}</KeyBadge>
            </div>
            <p><KeyBadge>◀</KeyBadge> <KeyBadge>▶</KeyBadge> 버튼으로 하루씩 이동합니다.</p>
            <p>날짜를 클릭하면 달력이 열려서 원하는 날짜를 직접 선택할 수 있습니다.</p>
            <Tip>영업일은 오전 6시부터 다음날 오전 6시까지입니다. 자정 이후의 예약도 같은 날 조판지에 표시됩니다.</Tip>
          </SectionCard>

          {/* 4. Manager */}
          <SectionCard id="manager" number="4" title="담당자 설정">
            <p>조판지 상단 왼쪽의 <KeyBadge>담당자</KeyBadge> 버튼을 클릭하면 이름을 입력할 수 있습니다.</p>
            <p>입력한 담당자명은 하단 요약바에 표시되며, 해당 날짜의 담당자로 기록됩니다.</p>
            <Tip>담당자명은 날짜별로 저장됩니다.</Tip>
          </SectionCard>

          {/* 5. Add Slot */}
          <SectionCard id="add-slot" number="5" title="슬롯 추가">
            <p>각 관리사 칼럼 하단의 <KeyBadge>+ 추가</KeyBadge> 버튼을 클릭하면 새 슬롯을 등록할 수 있습니다.</p>
            <div className="bg-[#1a2035] rounded-lg p-4 text-xs space-y-2">
              <p><b className="text-slate-200">입력 항목:</b></p>
              <div className="grid grid-cols-2 gap-1.5 text-slate-400">
                <span>고객명 (이름 또는 전화번호 뒤 4자리)</span>
                <span>방 번호</span>
                <span>서비스명 (T60, T90 등)</span>
                <span>결제방식 (현금/카드/이체/쿠폰/복합)</span>
                <span>예약시간 (선택)</span>
                <span>비고 메모</span>
              </div>
            </div>
            <p><b className="text-slate-200">복합 결제:</b> 결제방식에서 &quot;복합&quot;을 선택하면 비고란에 <KeyBadge>현금3+카드2</KeyBadge> 형식으로 입력합니다.</p>
            <Tip>고객명에 &quot;로드&quot;가 포함되면 자동으로 로드 고객으로 분류됩니다.</Tip>
          </SectionCard>

          {/* 6. Arrival */}
          <SectionCard id="arrival" number="6" title="손님 도착 처리">
            <p>슬롯 카드 하단의 <KeyBadge>손님도착</KeyBadge> 버튼을 누르면 체크인 시간이 자동 기록됩니다.</p>
            <div className="bg-[#1a2035] rounded-lg p-4 text-xs space-y-2">
              <p><b className="text-slate-200">체크인 시간:</b> 현재 시각을 10분 단위로 올림 (예: 14:23 → 14:30)</p>
              <p><b className="text-slate-200">체크아웃 시간:</b> 서비스 시간(T60=60분, T90=90분 등)을 자동 계산</p>
            </div>
            <p>체크인 후 슬롯 카드에 <span className="text-red-400 font-bold text-xs">관리중</span> 배지가 표시되고, 서비스 완료 후 <span className="text-emerald-400 font-bold text-xs">완료</span> 배지로 변경됩니다.</p>
          </SectionCard>

          {/* 7. Edit / Delete */}
          <SectionCard id="edit-slot" number="7" title="슬롯 수정 / 삭제">
            <p>슬롯 카드를 클릭하면 수정 모달이 열립니다.</p>
            <p>모달에서 모든 정보를 수정할 수 있으며, 체크인/체크아웃 시간도 직접 변경 가능합니다.</p>
            <p>모달 하단의 <span className="text-red-400 font-bold">삭제</span> 버튼으로 슬롯을 삭제할 수 있습니다.</p>
            <Tip>삭제는 되돌릴 수 없으므로 주의하세요.</Tip>
          </SectionCard>

          {/* 8. Drag & Drop */}
          <SectionCard id="drag" number="8" title="드래그 앤 드롭">
            <p>슬롯 카드를 드래그하여 다른 관리사에게 이동하거나, 같은 관리사 내에서 순서를 변경할 수 있습니다.</p>
            <div className="bg-[#1a2035] rounded-lg p-4 text-xs space-y-2">
              <p><b className="text-slate-200">슬롯 → 슬롯:</b> 두 슬롯의 위치를 교체합니다.</p>
              <p><b className="text-slate-200">슬롯 → 빈 칸:</b> 해당 관리사의 마지막 슬롯으로 이동합니다.</p>
              <p><b className="text-slate-200">관리사 헤더 드래그:</b> 관리사 칼럼 순서를 변경합니다.</p>
            </div>
          </SectionCard>

          {/* 9. Footer */}
          <SectionCard id="footer" number="9" title="하단 매출 요약">
            <p>조판지 하단에 당일 매출 정보가 실시간으로 표시됩니다.</p>
            <div className="flex flex-wrap gap-2 bg-[#1a2035] rounded-lg p-4 text-xs">
              <span className="bg-[#0c0e18] px-2.5 py-1 rounded-lg"><span className="text-[#D4A574]">총매출</span> <b className="text-white">120,000</b></span>
              <span className="bg-[#0c0e18] px-2.5 py-1 rounded-lg"><span className="text-emerald-400">현금</span> <b className="text-white">80,000</b></span>
              <span className="bg-[#0c0e18] px-2.5 py-1 rounded-lg"><span className="text-blue-400">카드</span> <b className="text-white">40,000</b></span>
              <span className="bg-[#0c0e18] px-2.5 py-1 rounded-lg"><span className="text-purple-400">이체</span> <b className="text-white">0</b></span>
              <span className="bg-[#0c0e18] px-2.5 py-1 rounded-lg"><span className="text-amber-400">쿠폰</span> <b className="text-white">1명</b></span>
              <span className="bg-[#0c0e18] px-2.5 py-1 rounded-lg"><span className="text-rose-400">신규로드</span> <b className="text-white">2</b> <span className="text-orange-400 ml-1">기존로드</span> <b className="text-white">1</b> <span className="text-cyan-400 ml-1">신규</span> <b className="text-white">0</b></span>
            </div>
            <p>오른쪽 끝에는 관리사별 <b className="text-slate-200">커미션</b>이 표시됩니다.</p>
            <Tip>쿠폰 결제(비고에 CM 포함)는 매출에서 제외됩니다. 단, 스페셜(쿠폰구매)은 매출에 포함됩니다.</Tip>
          </SectionCard>

          {/* 10. Therapist */}
          <SectionCard id="therapist" number="10" title="관리사 관리">
            <p>사이드바에서 <KeyBadge>관리사</KeyBadge>를 클릭하면 관리사 관리 페이지로 이동합니다.</p>
            <div className="bg-[#1a2035] rounded-lg p-4 text-xs space-y-2">
              <p><b className="text-slate-200">관리사 추가:</b> 오른쪽 상단 &quot;관리사 추가&quot; 버튼</p>
              <p><b className="text-slate-200">순서 변경:</b> 테이블의 ▲▼ 화살표로 표시 순서 변경</p>
              <p><b className="text-slate-200">활성/비활성:</b> 토글 스위치로 관리사 활성 상태 변경</p>
              <p><b className="text-slate-200">출퇴근 관리:</b> 날짜를 선택하고 출근/미출근 버튼으로 출퇴근 기록</p>
            </div>
            <p>출근으로 표시된 관리사만 조판지에 칼럼으로 나타납니다.</p>
          </SectionCard>

          {/* 11. Stats */}
          <SectionCard id="stats" number="11" title="통계">
            <p>사이드바에서 <KeyBadge>통계</KeyBadge>를 클릭하면 매출 통계 페이지로 이동합니다.</p>
            <div className="bg-[#1a2035] rounded-lg p-4 text-xs space-y-2">
              <p><b className="text-slate-200">주간/월간 전환:</b> 상단 버튼으로 주간 ↔ 월간 보기 전환</p>
              <p><b className="text-slate-200">요약 카드:</b> 총매출, 예약 건수, 신규 고객, 쿠폰/스페셜</p>
              <p><b className="text-slate-200">일별 매출 그래프:</b> 바 차트로 매출 추이 확인</p>
              <p><b className="text-slate-200">결제수단 비율:</b> 현금/카드/이체 프로그레스 바</p>
              <p><b className="text-slate-200">일별 상세 테이블:</b> 날짜별 매출, 결제수단, 고객 수</p>
              <p><b className="text-slate-200">관리사별 커미션:</b> 관리사별 건수 및 커미션 금액</p>
              <p><b className="text-slate-200">신규/문자할인 고객:</b> 해당 고객 상세 목록</p>
            </div>
          </SectionCard>

          {/* 12. Worklog */}
          <SectionCard id="worklog" number="12" title="업무일지">
            <p>사이드바에서 <KeyBadge>업무일지</KeyBadge>를 클릭하면 일일 업무 기록 페이지로 이동합니다.</p>
            <div className="bg-[#1a2035] rounded-lg p-4 text-xs space-y-2">
              <p><b className="text-slate-200">자동 저장:</b> 내용을 입력하면 0.3초 후 자동 저장됩니다.</p>
              <p><b className="text-slate-200">기록 항목:</b> 매장 위생, 관리사 특이사항, 고객 특이사항, 관리자 특이사항, 기타 보고사항, 메모, 내일 계획, 프로그램 건의사항</p>
              <p><b className="text-slate-200">고객 항목:</b> + 항목 추가 버튼으로 고객 메모를 추가할 수 있습니다.</p>
              <p><b className="text-slate-200">오버/인수/인계:</b> 오버 고객, 타점 인계, 타점 인수 별도 기록</p>
            </div>
            <p>날짜를 변경하면 해당 날짜의 업무일지가 자동으로 로드됩니다.</p>
          </SectionCard>

          {/* Spacer */}
          <div className="h-8" />
        </div>
      </main>
    </div>
  )
}

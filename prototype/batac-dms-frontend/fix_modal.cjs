const fs = require('fs');

let code = fs.readFileSync('src/modals/index.jsx', 'utf8');

code = code.replace(
  /const \{ mutateAsync: addSession, isPending \} = useAddSession\(\)\s+const \[step, setStep\] = useState\(1\)/,
  `const { mutateAsync: addSession, isPending } = useAddSession()
  const updateLegislativeQueue = useUpdateLegislativeQueue()
  
  const unscheduledQueue = React.useMemo(() => {
    return queue.filter(item => !item.session || item.session === "TBD");
  }, [queue]);

  const [step, setStep] = useState(1)`
);

code = code.replace(
  /React\.useEffect\(\(\) => \{\s+if \(open\) setSelectedItems\(queue\.map\(i => i\.id\)\);\s+\}, \[open, queue\]\);/,
  `React.useEffect(() => {
    if (open) setSelectedItems(unscheduledQueue.map(i => i.id));
  }, [open, unscheduledQueue]);`
);

code = code.replace(
  /setSelectedItems\(queue\.map\(i => i\.id\)\)/,
  `setSelectedItems(unscheduledQueue.map(i => i.id))`
);

code = code.replace(
  /\} of \{queue\.length\} selected/,
  `} of {unscheduledQueue.length} selected`
);

code = code.replace(
  /s \=\> s\.length === queue\.length \? \[\] : queue\.map\(i \=\> i\.id\)/,
  `s => s.length === unscheduledQueue.length ? [] : unscheduledQueue.map(i => i.id)`
);

code = code.replace(
  /selectedItems\.length === queue\.length \? "Deselect all" : "Select all"/,
  `selectedItems.length === unscheduledQueue.length ? "Deselect all" : "Select all"`
);

code = code.replace(
  /\{queue\.map\(item => \{/,
  `{unscheduledQueue.map(item => {`
);

code = code.replace(
  /onClick=\{async \(\) => \{\s+await addSession\(\{([^}]*)\}\);\s+setStep\(3\)\s+\}\}/,
  `onClick={async () => {
              const sessionLabel = form.type === "special" ? "Special Session" : \\\`\${form.sessionNo}th Regular Session\\\`;
              await addSession({ $1 });
              await Promise.all(selectedItems.map(id => updateLegislativeQueue.mutateAsync({ id, session: sessionLabel })));
              setStep(3);
            }}`
);

fs.writeFileSync('src/modals/index.jsx', code);
console.log('Fixed ScheduleSessionModal');
